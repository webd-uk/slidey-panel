<?php
/*
 * Plugin Name: Slidey Panel
 * Version: 1.0
 * Plugin URI: https://webd.uk/slidey-panel/
 * Description: Adds a customizable sliding panel block to your WordPress site.
 * Author: Webd Ltd
 * Author URI: https://webd.uk
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Requires at least: 6.3
 * Requires PHP: 7.0
 * Text Domain: slidey-panel
 */

if (!defined('ABSPATH')) {
    exit('This isn\'t the page you\'re looking for. Move along, move along.');
}

if (!class_exists('slidey_panel_class')) {

    class slidey_panel_class {

        const VERSION = '1.0';
        const DEFAULT_CONTENT_OPTION = 'slidey_panel_default_content_id';
        const CONTENT_POST_TYPE = 'page';

        private $block_panel = '';
        private $rendering_slidey_panel_content = false;

        public function slidey_panel_load() {

            add_action('init', array($this, 'slidey_panel_init'));
            add_action('rest_api_init', array($this, 'slidey_panel_rest_api_init'));
            add_filter('render_block', array($this, 'slidey_panel_render_block'), 10, 2);
            add_action('wp_footer', array($this, 'slidey_panel_wp_footer'));

        }

        public function slidey_panel_init() {

            register_block_type(plugin_dir_path(__FILE__) . 'build');

        }

        public static function slidey_panel_can_use_block() {

            return current_user_can('edit_pages');

        }

        public static function slidey_panel_can_manage_default_content() {

            return current_user_can('manage_options');

        }

        public static function slidey_panel_get_content_posts() {

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
                    /* translators: %d is the page ID. */
                    'title' => $post->post_title ? $post->post_title : sprintf(__('Page #%d', 'slidey-panel'), absint($post->ID)),
                    'editLink' => current_user_can('edit_post', $post->ID) ? get_edit_post_link($post->ID, '') : '',
                );
            }

            return $content_posts;

        }

        public static function slidey_panel_get_default_content_id() {

            $content_id = absint(get_option(self::DEFAULT_CONTENT_OPTION));

            if ($content_id && 'publish' === get_post_status($content_id) && self::CONTENT_POST_TYPE === get_post_type($content_id)) {
                return $content_id;
            }

            if ($content_id) {
                delete_option(self::DEFAULT_CONTENT_OPTION);
            }

            return 0;

        }

        public function slidey_panel_rest_api_init() {

            register_rest_route(
                'slidey-panel/v1',
                '/content',
                array(
                    'methods' => 'GET',
                    'callback' => array($this, 'slidey_panel_rest_get_content'),
                    'permission_callback' => array(__CLASS__, 'slidey_panel_can_use_block'),
                )
            );

            register_rest_route(
                'slidey-panel/v1',
                '/default-content',
                array(
                    'methods' => 'POST',
                    'callback' => array($this, 'slidey_panel_rest_set_default_content'),
                    'permission_callback' => array(__CLASS__, 'slidey_panel_can_manage_default_content'),
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

        public function slidey_panel_rest_get_content() {

            return rest_ensure_response(
                array(
                    'contentPosts' => self::slidey_panel_get_content_posts(),
                    'defaultContentId' => self::slidey_panel_get_default_content_id(),
                    'createContentUrl' => admin_url('post-new.php?post_type=' . self::CONTENT_POST_TYPE),
                    'canCreateContent' => true,
                    'canManageDefaultContent' => self::slidey_panel_can_manage_default_content(),
                )
            );

        }

        public function slidey_panel_rest_set_default_content($request) {

            $content_id = absint($request->get_param('contentId'));

            if ($content_id && ('publish' !== get_post_status($content_id) || self::CONTENT_POST_TYPE !== get_post_type($content_id))) {
                return new WP_Error('slidey_panel_invalid_content_id', __('Invalid Slidey Panel page.', 'slidey-panel'), array('status' => 400));
            }

            if ($content_id) {
                update_option(self::DEFAULT_CONTENT_OPTION, $content_id, false);
            } else {
                delete_option(self::DEFAULT_CONTENT_OPTION);
            }

            return $this->slidey_panel_rest_get_content();

        }

        public static function slidey_panel_enqueue_block_frontend_assets() {

            wp_enqueue_style('slidey-panel-css', plugin_dir_url(__FILE__) . 'css/slidey-panel.css', array(), self::VERSION);
            wp_enqueue_script('slidey-panel-js', plugin_dir_url(__FILE__) . 'js/slidey-panel.js', array(), self::VERSION, true);

        }

        public function slidey_panel_render_block($block_content, $block) {

            if (
                $this->rendering_slidey_panel_content ||
                !$block_content ||
                !is_array($block) ||
                empty($block['blockName']) ||
                'slidey-panel/panel' !== $block['blockName']
            ) {
                return $block_content;
            }

            $content_id = self::slidey_panel_get_default_content_id();

            if (!$content_id) {
                return $block_content;
            }

            self::slidey_panel_enqueue_block_frontend_assets();
            $processor = new WP_HTML_Tag_Processor($block_content);

            if ($processor->next_tag()) {
                $processor->set_attribute('data-slidey-panel-content-id', absint($content_id));
                $block_content = $processor->get_updated_html();
            }

            if ('' === $this->block_panel) {
                $content = $this->slidey_panel_render_content_post($content_id);

                if ($content) {
                    ob_start();

?><section class="slidey-panel-panel slidey-panel-position-right" id="slidey-panel-panel-<?php echo esc_attr($content_id); ?>" data-slidey-panel-id="<?php echo esc_attr($content_id); ?>" data-slidey-panel-position="right" aria-hidden="true">
    <button type="button" class="slidey-panel-close" aria-label="<?php esc_attr_e('Close panel', 'slidey-panel'); ?>"><svg class="slidey-panel-close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="3 3 18 18" aria-hidden="true" focusable="false"><path d="m13.06 12 4.22-4.22-1.06-1.06L12 10.94 7.78 6.72 6.72 7.78 10.94 12l-4.22 4.22 1.06 1.06L12 13.06l4.22 4.22 1.06-1.06L13.06 12Z" /></svg></button>
    <div class="slidey-panel-content"><?php
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Rendered by the_content.
        echo $content;
    ?></div>
</section><?php

                    $this->block_panel = ob_get_clean();
                }
            }

            return $block_content;

        }

        public function slidey_panel_render_content_post($content_id) {

            $content_post = get_post(absint($content_id));

            if (!$content_post || self::CONTENT_POST_TYPE !== $content_post->post_type || 'publish' !== $content_post->post_status) {
                return '';
            }

            $this->rendering_slidey_panel_content = true;
            // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core content filter.
            $content = apply_filters('the_content', $content_post->post_content);
            $this->rendering_slidey_panel_content = false;

            return $content;

        }

        public function slidey_panel_wp_footer() {

            if (!$this->block_panel) {
                return;
            }

?><div class="slidey-panel-panels">
<?php // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Generated panel markup.
            echo $this->block_panel; ?>
</div>
<div class="slidey-panel-cover" hidden></div><?php

        }

    }

    $slidey_panel = new slidey_panel_class();
    $slidey_panel->slidey_panel_load();

}
