<?php
/**
 * The base configuration for WordPress
 */
define( 'DB_NAME', 'cpanel_wp_db' );
define( 'DB_USER', 'cpanel_wp_user' );
define( 'DB_PASSWORD', 'SecureP@ssw0rd!2026' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
