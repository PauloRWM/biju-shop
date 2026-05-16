<?php
defined( 'ABSPATH' ) || exit;

/**
 * Autenticação JWT simples para o frontend headless.
 * Não depende de biblioteca externa — usa HMAC-SHA256.
 */
class Biju_Auth {

    // -------------------------------------------------------------------------
    // Token generation / validation
    // -------------------------------------------------------------------------

    public static function generate_token( int $user_id ): string {
        $secret  = get_option( 'biju_jwt_secret', '' );
        $expiry  = get_option( 'biju_jwt_expiry', 3600 );
        $now     = time();

        $header  = self::base64url_encode( wp_json_encode( [ 'alg' => 'HS256', 'typ' => 'JWT' ] ) );
        $payload = self::base64url_encode( wp_json_encode( [
            'sub' => $user_id,
            'iat' => $now,
            'exp' => $now + (int) $expiry,
        ] ) );

        $sig = self::base64url_encode( hash_hmac( 'sha256', "$header.$payload", $secret, true ) );
        return "$header.$payload.$sig";
    }

    public static function validate_token( string $token ): int|false {
        $parts = explode( '.', $token );
        if ( count( $parts ) !== 3 ) return false;

        [ $header, $payload, $sig ] = $parts;
        $secret = get_option( 'biju_jwt_secret', '' );

        $expected = self::base64url_encode( hash_hmac( 'sha256', "$header.$payload", $secret, true ) );
        if ( ! hash_equals( $expected, $sig ) ) return false;

        $data = json_decode( self::base64url_decode( $payload ), true );
        if ( ! $data || ! isset( $data['exp'], $data['sub'] ) ) return false;
        if ( $data['exp'] < time() ) return false;

        return (int) $data['sub'];
    }

    /**
     * Extrai o user_id do header Authorization: Bearer <token>.
     * Retorna 0 se inválido.
     */
    public static function get_user_from_request( WP_REST_Request $request ): int {
        $auth = $request->get_header( 'authorization' );
        if ( ! $auth || ! str_starts_with( $auth, 'Bearer ' ) ) return 0;

        $token = substr( $auth, 7 );
        $user_id = self::validate_token( $token );
        return $user_id ?: 0;
    }

    // -------------------------------------------------------------------------
    // REST permission callbacks
    // -------------------------------------------------------------------------

    public static function require_auth( WP_REST_Request $request ): bool|WP_Error {
        $user_id = self::get_user_from_request( $request );
        if ( ! $user_id ) {
            return new WP_Error( 'unauthorized', 'Token inválido ou expirado.', [ 'status' => 401 ] );
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static function base64url_encode( string $data ): string {
        return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
    }

    private static function base64url_decode( string $data ): string {
        return base64_decode( strtr( $data, '-_', '+/' ) . str_repeat( '=', 3 - ( 3 + strlen( $data ) ) % 4 ) );
    }
}
