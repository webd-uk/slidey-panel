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

        if (is_array($network_plugins) && isset($network_plugins['sidemenu/sidemenu.php'])) {

            return true;

        }

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

        private $block_content_ids = array();
        private $block_panels = array();
        private $rendering_sidemenu_content = false;

        public function sidemenu_block_load() {

            // Register the SideMenu block metadata.
            add_action('init', array($this, 'sidemenu_block_init'));
            // Pass page content choices to the block editor.
            add_action('enqueue_block_editor_assets', array($this, 'sidemenu_block_enqueue_block_editor_assets'));
            // Register editor REST endpoints for page content selection.
            add_action('rest_api_init', array($this, 'sidemenu_block_rest_api_init'));
            // Hide the block for users who cannot edit pages.
            add_filter('allowed_block_types_all', array($this, 'sidemenu_block_allowed_block_types_all'), 10, 2);
            // Attach SideMenu panel rendering to saved block output.
            add_filter('render_block', array($this, 'sidemenu_block_render_block'), 10, 2);
            // Output collected SideMenu panels in the page footer.
            add_action('wp_footer', array($this, 'sidemenu_block_wp_footer'));

        }

        public static function sidemenu_block_plugin_path() {

            return plugin_dir_path(__FILE__);

        }

        public static function sidemenu_block_plugin_url() {

            return plugin_dir_url(__FILE__);

        }

        public function sidemenu_block_init() {

            register_block_type(self::sidemenu_block_plugin_path() . 'build');

        }

        public static function sidemenu_block_get_content_posts() {

            $posts = get_posts(
                array(
                    'numberposts' => -1,
                    'post_type' => self::CONTENT_POST_TYPE,
                    'post_status' => 'publish',
                    'orderby' => 'title',
                    'order' => 'ASC',
                )
            );
            $content_posts = array();

            foreach ($posts as $post) {

                $content_posts[] = array(
                    'id' => absint($post->ID),
                    /* translators: %d: Page ID. */
                    'title' => $post->post_title ? $post->post_title : sprintf(__('Page #%d', 'sidemenu-block'), absint($post->ID)),
                    'editLink' => current_user_can('edit_post', $post->ID) ? get_edit_post_link($post->ID, '') : '',
                );

            }

            return $content_posts;

        }

        public static function sidemenu_block_get_default_content_id($maybe_set = true) {

            $default_content_id = absint(get_option(self::DEFAULT_CONTENT_OPTION));

            if (
                $default_content_id &&
                'publish' === get_post_status($default_content_id) &&
                self::CONTENT_POST_TYPE === get_post_type($default_content_id)
            ) {

                return $default_content_id;

            }

            if ($default_content_id) {

                delete_option(self::DEFAULT_CONTENT_OPTION);
                $default_content_id = 0;

            }

            $content_posts = self::sidemenu_block_get_content_posts();

            if ($maybe_set && count($content_posts)) {

                $default_content_id = absint($content_posts[0]['id']);
                update_option(self::DEFAULT_CONTENT_OPTION, $default_content_id, false);

            }

            return $default_content_id;

        }

        public static function sidemenu_block_can_create_content_posts() {

            if (!self::sidemenu_block_can_use_block()) {

                return false;

            }

            $post_type = get_post_type_object(self::CONTENT_POST_TYPE);

            if ($post_type && isset($post_type->cap->create_posts)) {

                return current_user_can($post_type->cap->create_posts);

            }

            return current_user_can('edit_pages');

        }

        public static function sidemenu_block_can_use_block() {

            return (bool) apply_filters('sidemenu_block_can_use_block', current_user_can('edit_pages'));

        }

        public function sidemenu_block_allowed_block_types_all($allowed_block_types, $block_editor_context) {

            if (self::sidemenu_block_can_use_block()) {

                return $allowed_block_types;

            }

            if (true === $allowed_block_types) {

                $registered_block_types = WP_Block_Type_Registry::get_instance()->get_all_registered();
                $allowed_block_types = array_keys($registered_block_types);

            }

            if (!is_array($allowed_block_types)) {

                return $allowed_block_types;

            }

            return array_values(array_diff($allowed_block_types, array('sidemenu/sidemenu')));

        }

        public function sidemenu_block_enqueue_block_editor_assets() {

            $can_create_content = self::sidemenu_block_can_create_content_posts();
            $data = array(
                'contentPosts' => self::sidemenu_block_get_content_posts(),
                'defaultContentId' => self::sidemenu_block_get_default_content_id(),
                'contentPostType' => self::CONTENT_POST_TYPE,
                'createContentUrl' => $can_create_content ? admin_url('post-new.php?post_type=' . self::CONTENT_POST_TYPE) : '',
                'canCreateContent' => $can_create_content,
                'restNamespace' => 'sidemenu/v1',
            );

            wp_add_inline_script(
                'sidemenu-sidemenu-editor-script',
                'window.sideMenuBlock = ' . wp_json_encode($data) . ';',
                'before'
            );

        }

        public function sidemenu_block_rest_api_init() {

            register_rest_route(
                'sidemenu/v1',
                '/content',
                array(
                    'methods' => 'GET',
                    'callback' => array($this, 'sidemenu_block_rest_get_content'),
                    'permission_callback' => array($this, 'sidemenu_block_rest_can_edit'),
                )
            );

            register_rest_route(
                'sidemenu/v1',
                '/default-content',
                array(
                    'methods' => 'POST',
                    'callback' => array($this, 'sidemenu_block_rest_set_default_content'),
                    'permission_callback' => array($this, 'sidemenu_block_rest_can_edit'),
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

        public function sidemenu_block_rest_can_edit() {

            return self::sidemenu_block_can_use_block();

        }

        public function sidemenu_block_rest_get_content() {

            return rest_ensure_response(
                array(
                    'contentPosts' => self::sidemenu_block_get_content_posts(),
                    'defaultContentId' => self::sidemenu_block_get_default_content_id(),
                )
            );

        }

        public function sidemenu_block_rest_set_default_content($request) {

            $content_id = absint($request->get_param('contentId'));

            if (
                $content_id &&
                (
                    'publish' !== get_post_status($content_id) ||
                    self::CONTENT_POST_TYPE !== get_post_type($content_id)
                )
            ) {

                return new WP_Error('sidemenu_invalid_content_id', __('Invalid SideMenu page.', 'sidemenu-block'), array('status' => 400));

            }

            if ($content_id) {

                update_option(self::DEFAULT_CONTENT_OPTION, $content_id, false);

            } else {

                delete_option(self::DEFAULT_CONTENT_OPTION);

            }

            return $this->sidemenu_block_rest_get_content();

        }

        public static function sidemenu_block_get_block_content_id($attributes = array()) {

            $content_id = self::sidemenu_block_get_default_content_id();

            return absint(apply_filters('sidemenu_block_content_id', $content_id, $attributes));

        }

        public static function sidemenu_block_enqueue_block_frontend_assets() {

            wp_enqueue_style('sidemenu-block-css', self::sidemenu_block_plugin_url() . 'css/sidemenu-block.css', array(), self::VERSION);
            wp_enqueue_script('sidemenu-block-js', self::sidemenu_block_plugin_url() . 'js/sidemenu-block.js', array(), self::VERSION, true);
            $frontend_data = apply_filters(
                'sidemenu_block_frontend_data',
                array(
                    'openLabel' => __('Open menu', 'sidemenu-block'),
                    'closeColor' => self::sidemenu_block_get_default_close_color(),
                )
            );

            wp_localize_script('sidemenu-block-js', 'sideMenuBlockFrontend', $frontend_data);

        }

        public static function sidemenu_block_get_default_close_color() {

            $close_color = '#000000';

            if (function_exists('wp_theme_has_theme_json') && wp_theme_has_theme_json() && function_exists('wp_get_global_styles')) {

                $global_styles_color = wp_get_global_styles(array('color'));

                if (!empty($global_styles_color['text'])) {

                    $close_color = sanitize_hex_color($global_styles_color['text']);

                    if (!$close_color) {

                        $close_color = sanitize_text_field($global_styles_color['text']);

                    }

                }

            }

            return $close_color;

        }

        public static function sidemenu_block_get_panel_settings($content_id) {

            $settings = array(
                'transitionDuration' => '0.2s',
                'desktopWidth' => '45%',
                'desktopMinWidth' => '',
                'mobileWidth' => '100%',
                'mobileMinWidth' => '',
                'height' => 'var(--sidemenu-block-panel-height, 100vh)',
                'roundedCorners' => '',
                'scrollClose' => true,
                'coverClickClose' => true,
                'autoOpen' => false,
                'autoOpenDelay' => 0,
                'hideCloseButton' => false,
                'closeIconAnimation' => true,
                'closeIconSize' => '32px',
                'coverColor' => 'rgba(0, 0, 0, 0.6)',
            );

            return apply_filters('sidemenu_block_panel_settings', $settings, absint($content_id));

        }

        public static function sidemenu_block_sanitize_css_value($value) {

            return preg_replace('/[^a-zA-Z0-9\s\.\,\-\_\%\(\)\/\:]/', '', (string) $value);

        }

        public static function sidemenu_block_panel_style($settings) {

            $style_map = array(
                'transitionDuration' => '--sidemenu-block-transition-duration',
                'desktopWidth' => '--sidemenu-block-desktop-width',
                'desktopMinWidth' => '--sidemenu-block-desktop-min-width',
                'mobileWidth' => '--sidemenu-block-mobile-width',
                'mobileMinWidth' => '--sidemenu-block-mobile-min-width',
                'height' => '--sidemenu-block-panel-custom-height',
                'roundedCorners' => '--sidemenu-block-border-radius',
                'closeIconSize' => '--sidemenu-block-close-icon-size',
            );
            $styles = array();

            foreach ($style_map as $setting_key => $css_variable) {

                if (!empty($settings[$setting_key])) {

                    $styles[] = $css_variable . ': ' . self::sidemenu_block_sanitize_css_value($settings[$setting_key]);

                }

            }

            return implode('; ', $styles);

        }

        public static function sidemenu_block_bool_attr($value) {

            return $value ? 'true' : 'false';

        }

        public static function sidemenu_block_close_icon_svg($content_id, $settings) {

            $svg = '<svg class="sidemenu-block-close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="3 3 18 18" aria-hidden="true" focusable="false"><path d="m13.06 12 4.22-4.22-1.06-1.06L12 10.94 7.78 6.72 6.72 7.78 10.94 12l-4.22 4.22 1.06 1.06L12 13.06l4.22 4.22 1.06-1.06L13.06 12Z" /></svg>';

            return apply_filters('sidemenu_block_close_icon_svg', $svg, absint($content_id), $settings);

        }

        public static function sidemenu_block_close_button_html($content_id, $settings) {

            if (!empty($settings['hideCloseButton'])) {

                return '';

            }

            $close_class = 'sidemenu-block-close';

            if (isset($settings['closeIconAnimation']) && !$settings['closeIconAnimation']) {

                $close_class .= ' sidemenu-block-close-no-animation';

            }

            $close_html = '<button type="button" class="' . esc_attr($close_class) . '" aria-label="' . esc_attr__('Close menu', 'sidemenu-block') . '">' . self::sidemenu_block_close_icon_svg($content_id, $settings) . '</button>';

            return apply_filters('sidemenu_block_close_button_html', $close_html, absint($content_id), $settings);

        }

        public static function sidemenu_block_allowed_close_button_html() {

            return array(
                'button' => array(
                    'type' => true,
                    'class' => true,
                    'aria-label' => true,
                ),
                'svg' => array(
                    'class' => true,
                    'xmlns' => true,
                    'viewbox' => true,
                    'aria-hidden' => true,
                    'focusable' => true,
                ),
                'path' => array(
                    'd' => true,
                    'fill' => true,
                    'fill-rule' => true,
                    'transform' => true,
                ),
                'polygon' => array(
                    'fill' => true,
                    'fill-rule' => true,
                    'points' => true,
                    'transform' => true,
                ),
                'circle' => array(
                    'cx' => true,
                    'cy' => true,
                    'r' => true,
                    'fill' => true,
                    'transform' => true,
                ),
                'rect' => array(
                    'x' => true,
                    'y' => true,
                    'width' => true,
                    'height' => true,
                    'fill' => true,
                    'transform' => true,
                ),
            );

        }

        public static function sidemenu_block_add_block_data_attribute($block_content, $content_id) {

            if (class_exists('WP_HTML_Tag_Processor')) {

                $processor = new WP_HTML_Tag_Processor($block_content);

                if ($processor->next_tag()) {

                    $processor->set_attribute('data-sidemenu-content-id', absint($content_id));

                    return $processor->get_updated_html();

                }

            }

            return preg_replace(
                '/<div([^>]*)class="([^"\n]*wp-block-sidemenu-sidemenu[^"\n]*)"([^>]*)>/',
                '<div$1class="$2"$3 data-sidemenu-content-id="' . absint($content_id) . '">',
                $block_content,
                1
            );

        }

        public function sidemenu_block_render_block($block_content, $block) {

            if (
                $this->rendering_sidemenu_content ||
                !$block_content ||
                !is_array($block) ||
                !isset($block['blockName']) ||
                'sidemenu/sidemenu' !== $block['blockName']
            ) {

                return $block_content;

            }

            $attributes = isset($block['attrs']) && is_array($block['attrs']) ? $block['attrs'] : array();
            $content_id = self::sidemenu_block_get_block_content_id($attributes);

            if (!$content_id) {

                return $block_content;

            }

            self::sidemenu_block_enqueue_block_frontend_assets();
            $block_content = self::sidemenu_block_add_block_data_attribute($block_content, $content_id);
            $block_content = apply_filters('sidemenu_block_open_button_html', $block_content, $attributes, $content_id);
            $this->sidemenu_block_render_block_panel($content_id);

            return $block_content;

        }

        public function sidemenu_block_render_content_post($content_id) {

            $content_post = get_post(absint($content_id));

            if (
                !$content_post ||
                self::CONTENT_POST_TYPE !== $content_post->post_type ||
                'publish' !== $content_post->post_status
            ) {

                return '';

            }

            $this->rendering_sidemenu_content = true;
            // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Applies the core content filter to the selected page content.
            $content = apply_filters('the_content', $content_post->post_content);
            $this->rendering_sidemenu_content = false;

            return $content;

        }

        public function sidemenu_block_render_block_panel($content_id) {

            $content_id = absint($content_id);

            if (
                !$content_id ||
                in_array($content_id, $this->block_content_ids, true)
            ) {

                return '';

            }

            $content = $this->sidemenu_block_render_content_post($content_id);

            if (!$content) {

                return '';

            }

            $this->block_content_ids[] = $content_id;
            $settings = self::sidemenu_block_get_panel_settings($content_id);
            $panel_style = self::sidemenu_block_panel_style($settings);
            $close_button = self::sidemenu_block_close_button_html($content_id, $settings);

            ob_start();

?><section class="sidemenu-block-panel sidemenu-position-right" id="sidemenu-block-panel-<?php echo esc_attr($content_id); ?>" data-sidemenu-panel-id="<?php echo esc_attr($content_id); ?>" data-sidemenu-position="right" data-sidemenu-scroll-close="<?php echo esc_attr(self::sidemenu_block_bool_attr(!empty($settings['scrollClose']))); ?>" data-sidemenu-cover-click-close="<?php echo esc_attr(self::sidemenu_block_bool_attr(!empty($settings['coverClickClose']))); ?>" data-sidemenu-auto-open="<?php echo esc_attr(self::sidemenu_block_bool_attr(!empty($settings['autoOpen']))); ?>" data-sidemenu-auto-open-delay="<?php echo esc_attr(absint($settings['autoOpenDelay'])); ?>" data-sidemenu-cover-color="<?php echo esc_attr($settings['coverColor']); ?>"<?php echo $panel_style ? ' style="' . esc_attr($panel_style) . '"' : ''; ?> aria-hidden="true">
    <?php echo wp_kses($close_button, self::sidemenu_block_allowed_close_button_html()); ?>
    <div class="sidemenu-block-content"><?php
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Content has passed through WordPress's standard the_content pipeline.
        echo $content;
    ?></div>
</section><?php

            $this->block_panels[$content_id] = ob_get_clean();

            return '';

        }

        public function sidemenu_block_wp_footer() {

            if (!$this->block_panels) {

                return;

            }

?><div class="sidemenu-block-panels">
<?php
            foreach ($this->block_panels as $panel) {

                // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Panel markup is generated and escaped by sidemenu_block_render_block_panel().
                echo $panel;

            }
?></div>
<div class="sidemenu-block-cover" hidden></div><?php

        }

    }

    $sidemenu_block = new sidemenu_block_class();
    $sidemenu_block->sidemenu_block_load();

}
