<?php
if (!defined('ABSPATH')) {
    exit('This isn\'t the page you\'re looking for. Move along, move along.');
}

return array('dependencies' => array('wp-api-fetch', 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-element', 'wp-hooks', 'wp-i18n'), 'version' => sidemenu_block_class::VERSION);
