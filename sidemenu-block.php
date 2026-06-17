<?php
/*
 * Plugin Name: SideMenu Block
 * Version: 1.0
 * Plugin URI: https://webd.uk/product/sidemenu-block-upgrade/
 * Description: Adds a customizable sliding side menu block to your WordPress site.
 * Author: Webd Ltd
 * Author URI: https://webd.uk
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Requires at least: 6.2
 * Text Domain: sidemenu-block
 */

if (!defined('ABSPATH')) {
    exit('This isn\'t the page you\'re looking for. Move along, move along.');
}

function sidemenu_block_full_plugin_active() {

    if (class_exists('sidemenu_block_class')) {
        return true;
    }

    $active_plugins = get_option('active_plugins', array());

    if (is_array($active_plugins) && in_array('sidemenu/sidemenu.php', $active_plugins, true)) {
        return true;
    }

    if (is_multisite()) {
        $network_plugins = get_site_option('active_sitewide_plugins', array());

        return is_array($network_plugins) && isset($network_plugins['sidemenu/sidemenu.php']);
    }

    return false;

}

if (sidemenu_block_full_plugin_active()) {
    return;
}

if (!class_exists('sidemenu_block_class')) {

    class sidemenu_block_class {

        const VERSION = '1.0';
        const DEFAULT_CONTENT_OPTION = 'sidemenu_default_content_id';
        const CONTENT_POST_TYPE = 'page';

        private $block_panels = array();
        private $rendering_sidemenu_content = false;

        public function sidemenu_block_load() {

            add_action('init', array($this, 'sidemenu_block_init'));
            add_action('rest_api_init', array($this, 'sidemenu_block_rest_api_init'));
            add_filter('render_block', array($this, 'sidemenu_block_render_block'), 10, 2);
            add_action('wp_footer', array($this, 'sidemenu_block_wp_footer'));

        }

        public function sidemenu_block_init() {

            register_block_type(plugin_dir_path(__FILE__) . 'build');

        }

        public static function sidemenu_block_can_use_block() {

            return current_user_can('edit_pages');

        }

        public static function sidemenu_block_get_content_posts() {

            $content_posts = array();
            $posts = get_posts(
                array(
                    'numberposts' => -1,
                    'post_type' => self::CONTENT_POST_TYPE,
                    'post_status' => 'publish',
                    'orderby' => 'title',
                    'order' => 'ASC',
                )
            );

            foreach ($posts as $post) {
                $content_posts[] = array(
                    'id' => absint($post->ID),
                    'title' => $post->post_title ? $post->post_title : sprintf(__('Page #%d', 'sidemenu-block'), absint($post->ID)),
                    'editLink' => current_user_can('edit_post', $post->ID) ? get_edit_post_link($post->ID, '') : '',
                );
            }

            return $content_posts;

        }

        public static function sidemenu_block_get_default_content_id($maybe_set = true) {

            $content_id = absint(get_option(self::DEFAULT_CONTENT_OPTION));

            if ($content_id && 'publish' === get_post_status($content_id) && self::CONTENT_POST_TYPE === get_post_type($content_id)) {
                return $content_id;
            }

            if ($content_id) {
                delete_option(self::DEFAULT_CONTENT_OPTION);
            }

            $content_posts = self::sidemenu_block_get_content_posts();

            if ($maybe_set && $content_posts) {
                $content_id = absint($content_posts[0]['id']);
                update_option(self::DEFAULT_CONTENT_OPTION, $content_id, false);

                return $content_id;
            }

            return 0;

        }

        public function sidemenu_block_rest_api_init() {

            register_rest_route(
                'sidemenu/v1',
                '/content',
                array(
                    'methods' => 'GET',
                    'callback' => array($this, 'sidemenu_block_rest_get_content'),
                    'permission_callback' => array(__CLASS__, 'sidemenu_block_can_use_block'),
                )
            );

            register_rest_route(
                'sidemenu/v1',
                '/default-content',
                array(
                    'methods' => 'POST',
                    'callback' => array($this, 'sidemenu_block_rest_set_default_content'),
                    'permission_callback' => array(__CLASS__, 'sidemenu_block_can_use_block'),
                    'args' => array(
                        'contentId' => array(
                            'type' => 'integer',
                            'required' => true,
                            'sanitize_callback' => 'absint',
                        ),
                    ),
                )
            );

        }

        public function sidemenu_block_rest_get_content() {

            return rest_ensure_response(
                array(
                    'contentPosts' => self::sidemenu_block_get_content_posts(),
                    'defaultContentId' => self::sidemenu_block_get_default_content_id(),
                    'createContentUrl' => admin_url('post-new.php?post_type=' . self::CONTENT_POST_TYPE),
                    'canCreateContent' => true,
                )
            );

        }

        public function sidemenu_block_rest_set_default_content($request) {

            $content_id = absint($request->get_param('contentId'));

            if ($content_id && ('publish' !== get_post_status($content_id) || self::CONTENT_POST_TYPE !== get_post_type($content_id))) {
                return new WP_Error('sidemenu_invalid_content_id', __('Invalid SideMenu page.', 'sidemenu-block'), array('status' => 400));
            }

            if ($content_id) {
                update_option(self::DEFAULT_CONTENT_OPTION, $content_id, false);
            } else {
                delete_option(self::DEFAULT_CONTENT_OPTION);
            }

            return $this->sidemenu_block_rest_get_content();

        }

        public static function sidemenu_block_enqueue_block_frontend_assets() {

            wp_enqueue_style('sidemenu-block-css', plugin_dir_url(__FILE__) . 'css/sidemenu-block.css', array(), self::VERSION);
            wp_enqueue_script('sidemenu-block-js', plugin_dir_url(__FILE__) . 'js/sidemenu-block.js', array(), self::VERSION, true);

        }

        public function sidemenu_block_render_block($block_content, $block) {

            if (
                $this->rendering_sidemenu_content ||
                !$block_content ||
                !is_array($block) ||
                empty($block['blockName']) ||
                'sidemenu-block/sidemenu' !== $block['blockName']
            ) {
                return $block_content;
            }

            $content_id = self::sidemenu_block_get_default_content_id();

            if (!$content_id) {
                return $block_content;
            }

            self::sidemenu_block_enqueue_block_frontend_assets();
            $processor = new WP_HTML_Tag_Processor($block_content);

            if ($processor->next_tag()) {
                $processor->set_attribute('data-sidemenu-content-id', absint($content_id));
                $block_content = $processor->get_updated_html();
            }

            $this->sidemenu_block_render_block_panel($content_id);

            return $block_content;

        }

        public function sidemenu_block_render_content_post($content_id) {

            $content_post = get_post(absint($content_id));

            if (!$content_post || self::CONTENT_POST_TYPE !== $content_post->post_type || 'publish' !== $content_post->post_status) {
                return '';
            }

            $this->rendering_sidemenu_content = true;
            $content = apply_filters('the_content', $content_post->post_content);
            $this->rendering_sidemenu_content = false;

            return $content;

        }

        public function sidemenu_block_render_block_panel($content_id) {

            $content_id = absint($content_id);

            if (!$content_id || isset($this->block_panels[$content_id])) {
                return '';
            }

            $content = $this->sidemenu_block_render_content_post($content_id);

            if (!$content) {
                return '';
            }

            $this->block_panels[$content_id] = $this->sidemenu_block_get_panel_html($content_id, $content);

            return '';

        }

        public function sidemenu_block_get_panel_html($content_id, $content) {

            ob_start();

?><section class="sidemenu-block-panel sidemenu-position-right" id="sidemenu-block-panel-<?php echo esc_attr($content_id); ?>" data-sidemenu-panel-id="<?php echo esc_attr($content_id); ?>" data-sidemenu-position="right" aria-hidden="true">
    <button type="button" class="sidemenu-block-close" aria-label="<?php esc_attr_e('Close menu', 'sidemenu-block'); ?>"><svg class="sidemenu-block-close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="3 3 18 18" aria-hidden="true" focusable="false"><path d="m13.06 12 4.22-4.22-1.06-1.06L12 10.94 7.78 6.72 6.72 7.78 10.94 12l-4.22 4.22 1.06 1.06L12 13.06l4.22 4.22 1.06-1.06L13.06 12Z" /></svg></button>
    <div class="sidemenu-block-content"><?php echo $content; ?></div>
</section><?php

            return ob_get_clean();

        }

        public function sidemenu_block_wp_footer() {

            if (!$this->block_panels) {
                return;
            }

?><div class="sidemenu-block-panels">
<?php foreach ($this->block_panels as $panel) { echo $panel; } ?>
</div>
<div class="sidemenu-block-cover" hidden></div><?php

        }

    }

    $sidemenu_block = new sidemenu_block_class();
    $sidemenu_block->sidemenu_block_load();

}
