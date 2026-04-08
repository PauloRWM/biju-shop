<?php
defined( 'ABSPATH' ) || exit;

/**
 * Configura CORS para permitir que o frontend React acesse a API REST.
 */
class Biju_CORS {

    public static function init() {
        add_action( 'rest_api_init', [ __CLASS__, 'add_cors_headers' ], 15 );
        add_filter( 'rest_pre_serve_request', [ __CLASS__, 'handle_preflight' ], 10, 4 );
    }

    public static function add_cors_headers() {
        remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
        add_filter( 'rest_pre_serve_request', [ __CLASS__, 'send_cors_headers' ], 10, 4 );
    }

    public static function send_cors_headers( $served, $result, $request, $server ) {
        $origin = get_http_origin();
        $allowed = self::get_allowed_origins();

        if ( $origin && in_array( $origin, $allowed, true ) ) {
            header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
            header( 'Access-Control-Allow-Credentials: true' );
        }

        header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
        header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages' );

        return $served;
    }

    public static function handle_preflight( $served, $result, $request, $server ) {
        if ( 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
            self::send_cors_headers( $served, $result, $request, $server );
            header( 'Access-Control-Max-Age: 86400' );
            status_header( 204 );
            exit;
        }
        return $served;
    }

    private static function get_allowed_origins(): array {
        $frontend_url = get_option( 'biju_frontend_url', 'http://localhost:8080' );
        $origins = [ $frontend_url ];

        // Suporte a múltiplas origens via filtro
        return apply_filters( 'biju_allowed_origins', $origins );
    }
}
