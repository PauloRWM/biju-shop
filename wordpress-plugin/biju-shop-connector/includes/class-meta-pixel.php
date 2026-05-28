<?php
defined( 'ABSPATH' ) || exit;

/**
 * Integração Meta Pixel + Conversions API (CAPI).
 *
 * Resolve discrepâncias de tracking (adblock, ITP, iOS, perda de cookies)
 * enviando os mesmos eventos pelo navegador (pixel) E pelo servidor (CAPI),
 * usando o mesmo `event_id` para o Meta deduplicar automaticamente.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
class Biju_Meta_Pixel {

    const API_VERSION = 'v19.0';

    public static function init() {
        // Dispara Purchase via CAPI quando o pedido é pago
        add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'send_purchase_capi' ], 20, 2 );
        add_action( 'woocommerce_order_status_completed',  [ __CLASS__, 'send_purchase_capi' ], 20, 2 );
        add_action( 'woocommerce_payment_complete',        [ __CLASS__, 'send_purchase_capi' ], 20, 1 );
    }

    // -------------------------------------------------------------------------
    // Configuração
    // -------------------------------------------------------------------------

    public static function get_config(): array {
        return [
            'enabled'         => (bool) get_option( 'biju_meta_enabled', false ),
            'pixel_id'        => trim( (string) get_option( 'biju_meta_pixel_id', '' ) ),
            'access_token'    => trim( (string) get_option( 'biju_meta_access_token', '' ) ),
            'test_event_code' => trim( (string) get_option( 'biju_meta_test_event_code', '' ) ),
        ];
    }

    public static function is_configured(): bool {
        $cfg = self::get_config();
        return $cfg['enabled'] && $cfg['pixel_id'] && $cfg['access_token'];
    }

    /**
     * Config exposta ao frontend (nunca devolve o access token).
     */
    public static function get_public_config(): array {
        $cfg = self::get_config();
        return [
            'enabled'         => $cfg['enabled'] && $cfg['pixel_id'] !== '',
            'pixel_id'        => $cfg['pixel_id'],
            'test_event_code' => $cfg['test_event_code'],
        ];
    }

    // -------------------------------------------------------------------------
    // Envio CAPI
    // -------------------------------------------------------------------------

    /**
     * Envia um evento (ou batch) para a Conversions API.
     *
     * @param array $events  Lista de eventos no formato CAPI.
     * @return array { success: bool, response?: mixed, error?: string }
     */
    public static function send_events( array $events ): array {
        if ( ! self::is_configured() ) {
            return [ 'success' => false, 'error' => 'meta_not_configured' ];
        }
        if ( empty( $events ) ) {
            return [ 'success' => false, 'error' => 'no_events' ];
        }

        $cfg  = self::get_config();
        $url  = sprintf(
            'https://graph.facebook.com/%s/%s/events',
            self::API_VERSION,
            rawurlencode( $cfg['pixel_id'] )
        );

        $payload = [
            'data'         => array_values( $events ),
            'access_token' => $cfg['access_token'],
        ];
        if ( $cfg['test_event_code'] ) {
            $payload['test_event_code'] = $cfg['test_event_code'];
        }

        $resp = wp_remote_post( $url, [
            'timeout' => 8,
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => wp_json_encode( $payload ),
        ] );

        if ( is_wp_error( $resp ) ) {
            self::log( 'CAPI error: ' . $resp->get_error_message() );
            return [ 'success' => false, 'error' => $resp->get_error_message() ];
        }

        $code = wp_remote_retrieve_response_code( $resp );
        $body = json_decode( wp_remote_retrieve_body( $resp ), true );

        if ( $code !== 200 ) {
            self::log( "CAPI HTTP $code: " . wp_json_encode( $body ) );
            return [ 'success' => false, 'error' => "http_$code", 'response' => $body ];
        }

        return [ 'success' => true, 'response' => $body ];
    }

    // -------------------------------------------------------------------------
    // Helpers para montar eventos
    // -------------------------------------------------------------------------

    /**
     * Hashifica um valor para user_data (lowercase + trim + sha256).
     */
    public static function hash( ?string $value ): ?string {
        if ( ! $value ) return null;
        return hash( 'sha256', strtolower( trim( $value ) ) );
    }

    /**
     * Hash sem normalização (já vem normalizado, ex: cpf só dígitos).
     */
    public static function hash_raw( ?string $value ): ?string {
        if ( ! $value ) return null;
        return hash( 'sha256', $value );
    }

    /**
     * Normaliza telefone BR para E.164 sem o "+" (formato exigido pelo Meta):
     *   "(11) 99999-8888" → "5511999998888"
     * Se o número já vier com 55 no início (12-13 dígitos), mantém.
     * Para 10 ou 11 dígitos (BR), prepende 55. Outros tamanhos: retorna como veio.
     */
    public static function normalize_phone_br( ?string $phone ): ?string {
        if ( ! $phone ) return null;
        $digits = preg_replace( '/\D/', '', $phone );
        if ( $digits === '' ) return null;
        $len = strlen( $digits );
        if ( ( $len === 10 || $len === 11 ) && substr( $digits, 0, 2 ) !== '55' ) {
            return '55' . $digits;
        }
        return $digits;
    }

    public static function client_ip(): ?string {
        $candidates = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR',
        ];
        foreach ( $candidates as $key ) {
            if ( ! empty( $_SERVER[ $key ] ) ) {
                $ip = trim( explode( ',', $_SERVER[ $key ] )[0] );
                if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) return $ip;
            }
        }
        return null;
    }

    public static function client_user_agent(): ?string {
        return $_SERVER['HTTP_USER_AGENT'] ?? null;
    }

    /**
     * Lê os cookies _fbp e _fbc do navegador (se chegaram via REST request).
     */
    public static function fb_cookies(): array {
        return [
            'fbp' => $_COOKIE['_fbp'] ?? null,
            'fbc' => $_COOKIE['_fbc'] ?? null,
        ];
    }

    // -------------------------------------------------------------------------
    // Evento Purchase (gatilho de pedido pago)
    // -------------------------------------------------------------------------

    /**
     * Hook do WooCommerce — dispara CAPI Purchase quando o pedido é pago.
     * Idempotente via meta `_biju_meta_purchase_sent`.
     */
    public static function send_purchase_capi( int $order_id, $order = null ): void {
        if ( ! self::is_configured() ) return;

        $order = $order instanceof WC_Order ? $order : wc_get_order( $order_id );
        if ( ! $order ) return;

        if ( $order->get_meta( '_biju_meta_purchase_sent' ) ) {
            return; // já enviado
        }

        $event = self::build_purchase_event( $order );
        $result = self::send_events( [ $event ] );

        if ( ! empty( $result['success'] ) ) {
            $order->update_meta_data( '_biju_meta_purchase_sent', current_time( 'mysql' ) );
            $order->update_meta_data( '_biju_meta_purchase_event_id', $event['event_id'] );
            $order->save();
        } else {
            self::log( 'Purchase CAPI failed for order ' . $order_id . ': ' . wp_json_encode( $result ) );
        }
    }

    private static function build_purchase_event( WC_Order $order ): array {
        // event_id = mesmo usado pelo pixel no front (order_id) → Meta deduplica
        $event_id = 'order_' . $order->get_id();

        $contents = [];
        $content_ids = [];
        foreach ( $order->get_items() as $item ) {
            /** @var WC_Order_Item_Product $item */
            $product_id = $item->get_product_id();
            $contents[] = [
                'id'         => (string) $product_id,
                'quantity'   => (int) $item->get_quantity(),
                'item_price' => (float) ( $item->get_total() / max( 1, $item->get_quantity() ) ),
            ];
            $content_ids[] = (string) $product_id;
        }

        $cpf = $order->get_meta( '_billing_cpf' ) ?: $order->get_meta( '_cpf' ) ?: '';
        $cpf = preg_replace( '/\D/', '', $cpf );

        $phone = self::normalize_phone_br( $order->get_billing_phone() );

        // user_data hashado conforme exige o Meta
        $user_data = array_filter( [
            'em'         => self::hash( $order->get_billing_email() ),
            'ph'         => $phone ? self::hash_raw( $phone ) : null,
            'fn'         => self::hash( $order->get_billing_first_name() ),
            'ln'         => self::hash( $order->get_billing_last_name() ),
            'ct'         => self::hash( $order->get_billing_city() ),
            'st'         => self::hash( $order->get_billing_state() ),
            'zp'         => self::hash( preg_replace( '/\D/', '', $order->get_billing_postcode() ) ),
            'country'    => self::hash( strtolower( $order->get_billing_country() ?: 'br' ) ),
            'external_id'=> $cpf ? self::hash_raw( $cpf ) : null,
            'client_ip_address' => self::client_ip(),
            'client_user_agent' => self::client_user_agent(),
        ] );

        // _fbp e _fbc se disponíveis no meta do pedido (gravados pelo front no checkout)
        $fbp = $order->get_meta( '_biju_fbp' );
        $fbc = $order->get_meta( '_biju_fbc' );
        if ( $fbp ) $user_data['fbp'] = $fbp;
        if ( $fbc ) $user_data['fbc'] = $fbc;

        return [
            'event_name'      => 'Purchase',
            'event_time'      => time(),
            'event_id'        => $event_id,
            'action_source'   => 'website',
            'event_source_url'=> $order->get_meta( '_biju_checkout_url' )
                ?: get_option( 'biju_frontend_url', home_url() ),
            'user_data'       => $user_data,
            'custom_data'     => [
                'currency'     => $order->get_currency(),
                'value'        => (float) $order->get_total(),
                'content_type' => 'product',
                'content_ids'  => $content_ids,
                'contents'     => $contents,
                'order_id'     => (string) $order->get_id(),
                'num_items'    => array_sum( array_column( $contents, 'quantity' ) ),
            ],
        ];
    }

    // -------------------------------------------------------------------------
    // Evento genérico vindo do navegador (POST /meta/track)
    // -------------------------------------------------------------------------

    /**
     * Recebe um evento "browser" e completa com IP/UA/cookies do servidor antes
     * de enviar via CAPI. Eventos suportados: PageView, ViewContent, AddToCart,
     * InitiateCheckout, Search, Lead.
     */
    public static function track_browser_event( array $payload ): array {
        $allowed = [
            'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout',
            'AddPaymentInfo', 'Search', 'Lead', 'CompleteRegistration',
        ];
        $name = $payload['event_name'] ?? '';
        if ( ! in_array( $name, $allowed, true ) ) {
            return [ 'success' => false, 'error' => 'invalid_event_name' ];
        }

        $event_id = sanitize_text_field( $payload['event_id'] ?? wp_generate_uuid4() );
        $url      = esc_url_raw( $payload['event_source_url'] ?? '' );

        $custom = is_array( $payload['custom_data'] ?? null ) ? $payload['custom_data'] : [];
        $user   = is_array( $payload['user_data'] ?? null )   ? $payload['user_data']   : [];

        // Normaliza/hashifica campos de user_data. Telefone BR vira E.164 sem +.
        $email = $user['email'] ?? null;
        $phone = self::normalize_phone_br( $user['phone'] ?? null );
        $cpf   = preg_replace( '/\D/', '', (string) ( $user['external_id'] ?? $user['cpf'] ?? '' ) );
        $zp    = preg_replace( '/\D/', '', (string) ( $user['zp'] ?? $user['postcode'] ?? '' ) );

        $hashed = array_filter( [
            'em'         => $email ? self::hash( $email ) : null,
            'ph'         => $phone ? self::hash_raw( $phone ) : null,
            'fn'         => isset( $user['first_name'] ) ? self::hash( $user['first_name'] ) : null,
            'ln'         => isset( $user['last_name'] )  ? self::hash( $user['last_name'] )  : null,
            'ct'         => isset( $user['city'] )    ? self::hash( $user['city'] )    : null,
            'st'         => isset( $user['state'] )   ? self::hash( $user['state'] )   : null,
            'zp'         => $zp ? self::hash_raw( $zp ) : null,
            'country'    => isset( $user['country'] ) ? self::hash( strtolower( $user['country'] ) ) : null,
            'external_id'=> $cpf ? self::hash_raw( $cpf ) : null,
            'fbp'        => $user['fbp'] ?? self::fb_cookies()['fbp'],
            'fbc'        => $user['fbc'] ?? self::fb_cookies()['fbc'],
            'client_ip_address' => self::client_ip(),
            'client_user_agent' => self::client_user_agent(),
        ] );

        $event = [
            'event_name'       => $name,
            'event_time'       => time(),
            'event_id'         => $event_id,
            'action_source'    => 'website',
            'event_source_url' => $url ?: get_option( 'biju_frontend_url', home_url() ),
            'user_data'        => $hashed,
            'custom_data'      => self::sanitize_custom_data( $custom ),
        ];

        return self::send_events( [ $event ] );
    }

    private static function sanitize_custom_data( array $custom ): array {
        $out = [];
        if ( isset( $custom['currency'] ) )     $out['currency']     = sanitize_text_field( $custom['currency'] );
        if ( isset( $custom['value'] ) )        $out['value']        = (float) $custom['value'];
        if ( isset( $custom['content_type'] ) ) $out['content_type'] = sanitize_text_field( $custom['content_type'] );
        if ( isset( $custom['content_name'] ) ) $out['content_name'] = sanitize_text_field( $custom['content_name'] );
        if ( isset( $custom['content_category'] ) ) $out['content_category'] = sanitize_text_field( $custom['content_category'] );
        if ( isset( $custom['search_string'] ) ) $out['search_string'] = sanitize_text_field( $custom['search_string'] );
        if ( isset( $custom['num_items'] ) )    $out['num_items']    = (int) $custom['num_items'];

        if ( ! empty( $custom['content_ids'] ) && is_array( $custom['content_ids'] ) ) {
            $out['content_ids'] = array_map( 'strval', $custom['content_ids'] );
        }
        if ( ! empty( $custom['contents'] ) && is_array( $custom['contents'] ) ) {
            $out['contents'] = array_values( array_map( function ( $c ) {
                return [
                    'id'         => (string) ( $c['id'] ?? '' ),
                    'quantity'   => (int) ( $c['quantity'] ?? 1 ),
                    'item_price' => isset( $c['item_price'] ) ? (float) $c['item_price'] : null,
                ];
            }, $custom['contents'] ) );
        }
        return $out;
    }

    // -------------------------------------------------------------------------
    // Log
    // -------------------------------------------------------------------------

    public static function log( string $message ): void {
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( '[Biju Meta] ' . $message );
        }
    }
}
