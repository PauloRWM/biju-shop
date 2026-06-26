<?php
defined( 'ABSPATH' ) || exit;

/**
 * Processador de pagamentos via API REST oficial do Mercado Pago.
 *
 * Por que não usamos o $gateway->process_payment() do plugin Woo MP?
 *   Em chamadas headless (sem o checkout nativo do Woo no caminho), o plugin
 *   v7+ aborta silenciosamente em validações internas (device_id, nonce, etc.)
 *   retornando result=success sem chamar a API — pedido fica "aprovado" sem
 *   cobrança real. Esta classe chama a API do MP diretamente e atualiza o
 *   pedido com base na resposta real.
 *
 * Sincronia com o plugin Woo MP:
 *   - Lê access_token das mesmas opções que o plugin Woo grava
 *     (woocommerce_woo-mercado-pago-*_settings + opções legacy _mp_*).
 *   - Grava _mp_payment_id no pedido com o mesmo formato que o plugin Woo,
 *     para que reembolsos / webhooks / painel admin funcionem normalmente.
 *   - Webhook próprio em /biju/v1/mp-webhook recebe notificações do MP e
 *     atualiza o status do pedido.
 */
class Biju_MP_Processor {

    private const API_BASE = 'https://api.mercadopago.com';

    // ---------------------------------------------------------------------
    // Credenciais — lê do plugin Woo MP, sem duplicar config
    // ---------------------------------------------------------------------

    public static function is_sandbox(): bool {
        $v = get_option( '_mp_checkout_test_mode', '' );
        return $v === 'yes' || $v === '1';
    }

    public static function get_access_token(): string {
        $sandbox = self::is_sandbox();

        // Tenta primeiro nas opções legacy do plugin Woo MP
        if ( $sandbox ) {
            $tok = (string) get_option( '_mp_access_token_test', '' );
            if ( $tok ) return $tok;
        }
        $tok = (string) get_option( '_mp_access_token_prod', '' );
        if ( $tok ) return $tok;

        // Fallback: lê do array serializado dos gateways (formato moderno)
        foreach ( [ 'woocommerce_woo-mercado-pago-custom_settings',
                   'woocommerce_woo-mercado-pago-pix_settings',
                   'woocommerce_woo-mercado-pago-ticket_settings' ] as $opt ) {
            $arr = get_option( $opt, [] );
            if ( is_array( $arr ) ) {
                foreach ( [ '_mp_access_token_prod', 'access_token', 'mp_access_token' ] as $k ) {
                    if ( ! empty( $arr[ $k ] ) && is_string( $arr[ $k ] ) ) {
                        return (string) $arr[ $k ];
                    }
                }
            }
        }
        return '';
    }

    public static function get_public_key(): string {
        if ( self::is_sandbox() ) {
            $pk = (string) get_option( '_mp_public_key_test', '' );
            if ( $pk ) return $pk;
        }
        $pk = (string) get_option( '_mp_public_key_prod', '' );
        if ( $pk ) return $pk;
        return (string) get_option( '_mp_public_key', '' );
    }

    // ---------------------------------------------------------------------
    // HTTP — chamada à API REST do MP
    // ---------------------------------------------------------------------

    private static function http( string $method, string $path, array $body = [], string $idem_key = '', array $extra_headers = [] ): array {
        $token = self::get_access_token();
        if ( ! $token ) {
            return [ 'ok' => false, 'http_code' => 0, 'data' => [], 'error' => 'access_token vazio (configure o plugin Mercado Pago)' ];
        }

        $headers = [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
            'User-Agent'    => 'biju-shop-connector/1.0 (+wp)',
        ];
        if ( $idem_key !== '' ) {
            $headers['X-Idempotency-Key'] = $idem_key;
        }
        // Headers extras por chamada — ex.: X-meli-session-id (device fingerprint
        // do MP) que melhora a aprovação e reduz cc_rejected_high_risk.
        foreach ( $extra_headers as $hk => $hv ) {
            if ( $hv !== '' && $hv !== null ) {
                $headers[ $hk ] = $hv;
            }
        }

        // Timeout: o SDK oficial do MP usa 5s como padrão. PIX/cartão/boleto
        // respondem em 1-3s. 12s dá margem confortável para latência de rede
        // server-to-server sem prender o cliente na tela do checkout — 30s só
        // mascarava rede ruim e deixava o checkout "travado". O webhook
        // (/biju/v1/mp-webhook) reconcilia qualquer pagamento que confirme depois.
        $args = [
            'method'  => strtoupper( $method ),
            'timeout' => (int) apply_filters( 'biju_mp_http_timeout', 12 ),
            'headers' => $headers,
        ];
        if ( $method !== 'GET' && $body ) {
            $args['body'] = wp_json_encode( $body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        }

        $resp = wp_remote_request( self::API_BASE . $path, $args );
        if ( is_wp_error( $resp ) ) {
            return [ 'ok' => false, 'http_code' => 0, 'data' => [], 'error' => $resp->get_error_message() ];
        }

        $code = (int) wp_remote_retrieve_response_code( $resp );
        $raw  = (string) wp_remote_retrieve_body( $resp );
        $data = json_decode( $raw, true );
        if ( ! is_array( $data ) ) $data = [];

        return [
            'ok'        => $code >= 200 && $code < 300,
            'http_code' => $code,
            'data'      => $data,
            'error'     => $code >= 400 ? ( $data['message'] ?? "HTTP $code" ) : '',
        ];
    }

    // ---------------------------------------------------------------------
    // Cobranças
    // ---------------------------------------------------------------------

    /**
     * Cobra cartão de crédito.
     *
     * $card_payload (do frontend, MP JS v2):
     *   token, payment_method_id, installments, issuer_id, holder_name,
     *   bin, last_four_digits, expiration_month, expiration_year
     */
    public static function charge_card( WC_Order $order, array $card_payload ): array {
        $cpf = self::get_cpf_from_order( $order );

        if ( empty( $card_payload['token'] ) ) {
            return [ 'error' => 'missing_card_token', 'message' => 'Token do cartão ausente.' ];
        }
        if ( ! $cpf ) {
            return [ 'error' => 'missing_cpf', 'message' => 'CPF é obrigatório para pagamento com cartão.' ];
        }

        // Mercado Pago exige payer.email obrigatoriamente em /v1/payments mesmo
        // para cartão (API retorna 400 sem ele). Sanitizamos email e nomes para
        // evitar recusas por dados malformados / antifraude.
        $email      = self::sanitize_payer_email( $order->get_billing_email(), $cpf );
        $first_name = self::sanitize_payer_name( $order->get_billing_first_name(), 'Cliente' );
        $last_name  = self::sanitize_payer_name( $order->get_billing_last_name(),  'Bijushop' );

        $body = [
            'transaction_amount'   => round( (float) $order->get_total(), 2 ),
            'token'                => (string) $card_payload['token'],
            'description'          => 'Pedido #' . $order->get_id(),
            'installments'         => max( 1, (int) ( $card_payload['installments'] ?? 1 ) ),
            'payment_method_id'    => (string) ( $card_payload['payment_method_id'] ?? '' ),
            'external_reference'   => 'WC-' . $order->get_id(),
            'notification_url'     => self::webhook_url(),
            'statement_descriptor' => self::statement_descriptor(),
            'capture'              => true, // captura automática
            'payer'                => [
                'email'          => $email,
                'first_name'     => $first_name,
                'last_name'      => $last_name,
                'identification' => [
                    'type'   => 'CPF',
                    'number' => $cpf,
                ],
            ],
            'metadata' => [
                'wc_order_id' => $order->get_id(),
                'source'      => 'biju-shop-headless',
            ],
        ];
        if ( ! empty( $card_payload['issuer_id'] ) ) {
            $body['issuer_id'] = (string) $card_payload['issuer_id'];
        }

        // additional_info: itens + telefone + endereço do pagador. O antifraude
        // do MP usa esses dados para aprovar; sem eles a recusa
        // cc_rejected_high_risk dispara. (Ver build_additional_info.)
        $body['additional_info'] = self::build_additional_info( $order );

        // device_id (MP_DEVICE_SESSION_ID capturado no front via security.js) vai
        // no header X-meli-session-id — maior fator isolado de aprovação.
        $device_id = isset( $card_payload['device_id'] ) ? (string) $card_payload['device_id'] : '';
        $headers   = $device_id !== '' ? [ 'X-meli-session-id' => $device_id ] : [];

        return self::process_payment_response( $order, 'card', $body, $headers );
    }

    /**
     * Cobra via PIX. Retorna QR Code base64 + copia-e-cola pro frontend.
     */
    public static function charge_pix( WC_Order $order ): array {
        $cpf = self::get_cpf_from_order( $order );
        if ( ! $cpf ) {
            return [ 'error' => 'missing_cpf', 'message' => 'CPF é obrigatório para pagar com PIX.' ];
        }
        $email      = self::sanitize_payer_email( $order->get_billing_email(), $cpf );
        $first_name = self::sanitize_payer_name( $order->get_billing_first_name(), 'Cliente' );
        $last_name  = self::sanitize_payer_name( $order->get_billing_last_name(),  'Bijushop' );

        // Expiração: 10 horas. O cliente tem prazo confortável para pagar e o
        // webhook do MP atualiza o pedido automaticamente quando a transferência
        // cai. Caso expire sem pagamento, o MP cancela e o pedido vira 'failed'.
        $expires_at = gmdate( 'Y-m-d\TH:i:s.000P', time() + 10 * 3600 );

        $body = [
            'transaction_amount'   => round( (float) $order->get_total(), 2 ),
            'description'          => 'Pedido #' . $order->get_id(),
            'payment_method_id'    => 'pix',
            'external_reference'   => 'WC-' . $order->get_id(),
            'notification_url'     => self::webhook_url(),
            'date_of_expiration'   => $expires_at,
            'payer'                => [
                'email'          => $email,
                'first_name'     => $first_name,
                'last_name'      => $last_name,
                'identification' => [ 'type' => 'CPF', 'number' => $cpf ],
            ],
            'metadata' => [
                'wc_order_id' => $order->get_id(),
                'source'      => 'biju-shop-headless',
            ],
        ];

        return self::process_payment_response( $order, 'pix', $body );
    }

    /**
     * Cobra via boleto bancário (bolbradesco).
     */
    public static function charge_boleto( WC_Order $order ): array {
        $cpf = self::get_cpf_from_order( $order );
        if ( ! $cpf ) {
            return [ 'error' => 'missing_cpf', 'message' => 'CPF é obrigatório para gerar boleto.' ];
        }
        $email      = self::sanitize_payer_email( $order->get_billing_email(), $cpf );
        $first_name = self::sanitize_payer_name( $order->get_billing_first_name(), 'Cliente' );
        $last_name  = self::sanitize_payer_name( $order->get_billing_last_name(),  'Bijushop' );

        // Boleto vence em 3 dias úteis (aprox 5 corridos pra cobrir fim de semana)
        $expires_at = gmdate( 'Y-m-d\TH:i:s.000P', time() + 5 * 86400 );

        $body = [
            'transaction_amount'  => round( (float) $order->get_total(), 2 ),
            'description'         => 'Pedido #' . $order->get_id(),
            'payment_method_id'   => 'bolbradesco',
            'external_reference'  => 'WC-' . $order->get_id(),
            'notification_url'    => self::webhook_url(),
            'date_of_expiration'  => $expires_at,
            'payer'               => [
                'email'           => $email,
                'first_name'      => $first_name,
                'last_name'       => $last_name,
                'identification'  => [ 'type' => 'CPF', 'number' => $cpf ],
                'address'         => [
                    'zip_code'     => preg_replace( '/\D/', '', $order->get_billing_postcode() ),
                    'street_name'  => $order->get_billing_address_1(),
                    'street_number'=> $order->get_meta( '_billing_number' ) ?: 'S/N',
                    'neighborhood' => $order->get_meta( '_billing_neighborhood' ) ?: $order->get_billing_address_2(),
                    'city'         => $order->get_billing_city(),
                    'federal_unit' => $order->get_billing_state(),
                ],
            ],
            'metadata' => [
                'wc_order_id' => $order->get_id(),
                'source'      => 'biju-shop-headless',
            ],
        ];

        return self::process_payment_response( $order, 'boleto', $body );
    }

    // ---------------------------------------------------------------------
    // Reembolso
    // ---------------------------------------------------------------------

    public static function refund( WC_Order $order, ?float $amount = null ): array {
        $payment_id = $order->get_meta( '_mp_payment_id' );
        if ( ! $payment_id ) {
            return [ 'error' => 'no_payment_id', 'message' => 'Pedido sem payment_id do Mercado Pago.' ];
        }

        $body = [];
        if ( $amount !== null && $amount > 0 ) {
            $body['amount'] = round( $amount, 2 );
        }

        $resp = self::http( 'POST', "/v1/payments/{$payment_id}/refunds", $body, 'refund-' . $order->get_id() . '-' . time() );
        self::log( $order, 'refund_response', $resp );
        return $resp['ok']
            ? [ 'ok' => true, 'refund_id' => $resp['data']['id'] ?? null ]
            : [ 'error' => 'refund_failed', 'message' => $resp['error'] ?: 'Falha ao reembolsar via Mercado Pago.' ];
    }

    // ---------------------------------------------------------------------
    // Processamento da resposta — atualiza pedido conforme status do MP
    // ---------------------------------------------------------------------

    private static function process_payment_response( WC_Order $order, string $kind, array $body, array $extra_headers = [] ): array {
        // Idempotency key estável DENTRO de uma mesma tentativa de pagamento.
        // Usar time() (como antes) tornava cada clique uma chave nova — um
        // duplo-clique no botão "pagar" podia gerar DUAS cobranças. Em vez disso
        // mantemos um contador de tentativas no pedido: ele só incrementa quando
        // há uma nova tentativa real (cliente troca o cartão e tenta de novo
        // após recusa), o que mantém a proteção contra duplicidade do MP intacta
        // e ainda permite o retry legítimo.
        $attempt_meta = '_biju_mp_attempt_' . $kind;
        $attempt      = (int) $order->get_meta( $attempt_meta );
        if ( $attempt < 1 ) {
            $attempt = 1;
            $order->update_meta_data( $attempt_meta, $attempt );
            $order->save();
        }
        $idem_key = 'order-' . $order->get_id() . '-' . $kind . '-' . $attempt;
        $resp = self::http( 'POST', '/v1/payments', $body, $idem_key, $extra_headers );
        self::log( $order, "{$kind}_request", [ 'body' => self::mask_for_log( $body ) ] );
        self::log( $order, "{$kind}_response", $resp );

        if ( ! $resp['ok'] ) {
            $msg = $resp['data']['message'] ?? $resp['error'] ?? 'Falha na comunicação com o Mercado Pago.';
            $cause = '';
            if ( ! empty( $resp['data']['cause'] ) && is_array( $resp['data']['cause'] ) ) {
                $cause = $resp['data']['cause'][0]['description'] ?? ( $resp['data']['cause'][0]['code'] ?? '' );
            }
            $order->add_order_note( 'MP API error: ' . ( $cause ?: $msg ) );
            $order->update_status( 'failed', "Falha no Mercado Pago ($kind)." );
            return [ 'error' => 'mp_api_error', 'message' => $cause ?: $msg ];
        }

        $payment       = $resp['data'];
        $payment_id    = (string) ( $payment['id'] ?? '' );
        $status        = (string) ( $payment['status'] ?? '' );
        $status_detail = (string) ( $payment['status_detail'] ?? '' );

        // Grava metadados (compatíveis com o que o plugin Woo MP usa)
        $order->update_meta_data( '_mp_payment_id', $payment_id );
        $order->update_meta_data( '_mp_payment_status', $status );
        $order->update_meta_data( '_mp_payment_status_detail', $status_detail );
        $order->update_meta_data( '_mp_payment_type', $kind );
        $order->save();

        // Atualiza status do pedido conforme status do MP
        switch ( $status ) {
            case 'approved':
                $order->payment_complete( $payment_id );
                $order->add_order_note( "Pagamento aprovado pelo Mercado Pago. payment_id={$payment_id}" );
                break;

            case 'in_process':
            case 'pending':
                $order->update_status( 'on-hold', "MP em análise/pendente ($kind). payment_id={$payment_id} status_detail={$status_detail}" );
                break;

            case 'rejected':
                // Incrementa o contador de tentativa para que um novo "pagar"
                // (ex: cliente corrige o cartão) use uma idempotency-key nova e
                // não receba a recusa anterior em cache do MP.
                $order->update_meta_data( $attempt_meta, $attempt + 1 );
                $order->save();
                $order->update_status( 'failed', "MP recusou o pagamento. status_detail={$status_detail}" );
                return [
                    'error'         => 'payment_rejected',
                    'message'       => self::status_detail_message( $status_detail ),
                    'status_detail' => $status_detail,
                ];

            case 'cancelled':
                $order->update_status( 'cancelled', "MP cancelou. status_detail={$status_detail}" );
                return [ 'error' => 'payment_cancelled', 'message' => 'Pagamento cancelado.' ];

            default:
                $order->add_order_note( "MP retornou status desconhecido: {$status}" );
                return [
                    'error'   => 'unknown_status',
                    'message' => 'Status de pagamento desconhecido. Aguarde a confirmação ou contate o suporte.',
                    'status'  => $status,
                ];
        }

        // Monta resposta pro frontend
        $out = [
            'payment_id'    => $payment_id,
            'status'        => $status,
            'status_detail' => $status_detail,
        ];

        // PIX: extrai QR
        if ( $kind === 'pix' ) {
            $tx = $payment['point_of_interaction']['transaction_data'] ?? [];
            $out['qr_code']         = (string) ( $tx['qr_code'] ?? '' );
            $out['qr_code_base64']  = (string) ( $tx['qr_code_base64'] ?? '' );
            $out['ticket_url']      = (string) ( $tx['ticket_url'] ?? '' );
            $out['expires_at']      = (string) ( $payment['date_of_expiration'] ?? '' );
        }

        // Boleto: extrai URL
        if ( $kind === 'boleto' ) {
            $out['boleto_url']    = (string) ( $payment['transaction_details']['external_resource_url'] ?? '' );
            $out['boleto_barcode']= (string) ( $payment['barcode']['content'] ?? '' );
            $out['expires_at']    = (string) ( $payment['date_of_expiration'] ?? '' );
        }

        return $out;
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /**
     * Monta o additional_info do pagamento (itens + dados do pagador) que o
     * antifraude do Mercado Pago usa para aprovar. Quanto mais completo e real,
     * menor a chance de cc_rejected_high_risk.
     */
    private static function build_additional_info( WC_Order $order ): array {
        $items = [];
        foreach ( $order->get_items() as $item ) {
            if ( ! ( $item instanceof WC_Order_Item_Product ) ) {
                continue;
            }
            $qty  = max( 1, (int) $item->get_quantity() );
            $unit = round( (float) $item->get_total() / $qty, 2 );
            $items[] = [
                'id'          => (string) ( $item->get_product_id() ?: $item->get_id() ),
                'title'       => mb_substr( (string) $item->get_name(), 0, 256 ),
                'category_id' => 'fashion',
                'quantity'    => $qty,
                'unit_price'  => $unit,
            ];
        }

        // Telefone BR → DDD (area_code) + número.
        $phone = preg_replace( '/\D/', '', (string) $order->get_billing_phone() );
        $area  = '';
        $num   = $phone;
        if ( strlen( (string) $phone ) >= 10 ) {
            $area = substr( $phone, 0, 2 );
            $num  = substr( $phone, 2 );
        }

        $payer = [
            'first_name' => self::sanitize_payer_name( $order->get_billing_first_name(), '' ),
            'last_name'  => self::sanitize_payer_name( $order->get_billing_last_name(), '' ),
        ];
        $phone_arr = array_filter( [ 'area_code' => $area, 'number' => $num ] );
        if ( $phone_arr ) {
            $payer['phone'] = $phone_arr;
        }
        $address = array_filter( [
            'zip_code'      => preg_replace( '/\D/', '', (string) $order->get_billing_postcode() ),
            'street_name'   => (string) $order->get_billing_address_1(),
            'street_number' => (string) ( $order->get_meta( '_billing_number' ) ?: '' ),
        ] );
        if ( $address ) {
            $payer['address'] = $address;
        }

        return array_filter( [
            'items' => $items,
            'payer' => array_filter( $payer ),
        ] );
    }

    private static function get_cpf_from_order( WC_Order $order ): string {
        $cpf = $order->get_meta( '_billing_cpf' ) ?: $order->get_meta( '_cpf' ) ?: '';
        return preg_replace( '/\D/', '', (string) $cpf );
    }

    /**
     * Normaliza email para enviar ao MP. Se o valor estiver vazio ou inválido,
     * devolve um placeholder válido baseado no CPF (formato aceito pela API).
     */
    private static function sanitize_payer_email( string $email, string $cpf_fallback ): string {
        $email = trim( strtolower( $email ) );
        if ( $email && is_email( $email ) ) return $email;
        $cpf_fallback = preg_replace( '/\D/', '', $cpf_fallback );
        if ( ! $cpf_fallback ) $cpf_fallback = (string) time();
        return 'cliente-' . $cpf_fallback . '@checkout.bijushop.com.br';
    }

    /**
     * Sanitiza nome do payer pro MP (sem acentos, sem dígitos, sem símbolos).
     * O antifraude rejeita "first_name inválido" quando vem com . / @ # etc.
     */
    private static function sanitize_payer_name( string $name, string $fallback ): string {
        $name = function_exists( 'remove_accents' ) ? remove_accents( $name ) : $name;
        $name = preg_replace( '/[^A-Za-z\s]/', '', (string) $name );
        $name = trim( preg_replace( '/\s+/', ' ', $name ) );
        return $name !== '' ? $name : $fallback;
    }

    public static function webhook_url(): string {
        return rest_url( BIJU_API_NAMESPACE . '/mp-webhook' );
    }

    private static function statement_descriptor(): string {
        $name = (string) get_option( 'blogname', 'Biju Shop' );
        // MP exige até 22 chars, sem acento, A-Z 0-9 espaço
        $clean = preg_replace( '/[^A-Z0-9 ]/i', '', remove_accents( $name ) );
        return strtoupper( substr( trim( $clean ?: 'BIJU SHOP' ), 0, 22 ) );
    }

    private static function status_detail_message( string $detail ): string {
        $map = [
            'cc_rejected_bad_filled_card_number' => 'Número do cartão incorreto. Confira os dígitos.',
            'cc_rejected_bad_filled_date'        => 'Data de validade incorreta.',
            'cc_rejected_bad_filled_security_code' => 'Código de segurança (CVV) incorreto.',
            'cc_rejected_bad_filled_other'       => 'Dados do cartão incorretos. Confira e tente novamente.',
            'cc_rejected_call_for_authorize'     => 'O emissor pediu autorização. Ligue para o banco e libere a compra.',
            'cc_rejected_card_disabled'          => 'Cartão desabilitado. Entre em contato com o banco.',
            'cc_rejected_card_error'             => 'Não conseguimos processar o pagamento. Tente outro cartão.',
            'cc_rejected_duplicated_payment'     => 'Pagamento duplicado detectado. Use outro cartão se quiser pagar de novo.',
            'cc_rejected_high_risk'              => 'Pagamento recusado por segurança. Tente outro meio de pagamento.',
            'cc_rejected_insufficient_amount'    => 'Saldo/limite insuficiente no cartão.',
            'cc_rejected_invalid_installments'   => 'Cartão não aceita esse parcelamento. Tente outra opção.',
            'cc_rejected_max_attempts'           => 'Limite de tentativas atingido. Tente novamente mais tarde.',
            'cc_rejected_other_reason'           => 'Cartão recusado pelo emissor. Tente outro cartão.',
            'cc_rejected_blacklist'              => 'Cartão recusado. Tente outro meio de pagamento.',
            'cc_rejected_card_type_not_allowed'  => 'Tipo de cartão não aceito.',
        ];
        return $map[ $detail ] ?? 'Pagamento recusado. Tente outro cartão ou meio de pagamento.';
    }

    private static function mask_for_log( array $body ): array {
        if ( isset( $body['token'] ) ) {
            $body['token'] = substr( (string) $body['token'], 0, 6 ) . '…';
        }
        if ( isset( $body['payer']['identification']['number'] ) ) {
            $cpf = (string) $body['payer']['identification']['number'];
            $body['payer']['identification']['number'] = '***' . substr( $cpf, -3 );
        }
        return $body;
    }

    private static function log( WC_Order $order, string $tag, array $payload ): void {
        if ( ! function_exists( 'wc_get_logger' ) ) return;
        wc_get_logger()->info(
            sprintf( "[order #%d] %s: %s", $order->get_id(), $tag, wp_json_encode( $payload, JSON_UNESCAPED_UNICODE ) ),
            [ 'source' => 'biju-mp' ]
        );
    }

    // ---------------------------------------------------------------------
    // Webhook — recebe notificações do MP e atualiza o pedido
    // ---------------------------------------------------------------------

    public static function handle_webhook( WP_REST_Request $request ): WP_REST_Response {
        $params = $request->get_params();
        $body   = $request->get_json_params() ?: [];

        // O MP manda 2 formatos: ?topic=payment&id=123 (legacy) e
        // { "type": "payment", "data": { "id": 123 } } (v1)
        $payment_id = '';
        if ( ! empty( $body['data']['id'] ) ) {
            $payment_id = (string) $body['data']['id'];
        } elseif ( ! empty( $params['data_id'] ) ) {
            $payment_id = (string) $params['data_id'];
        } elseif ( ! empty( $params['id'] ) && ( $params['topic'] ?? '' ) === 'payment' ) {
            $payment_id = (string) $params['id'];
        }

        if ( ! $payment_id ) {
            return new WP_REST_Response( [ 'ok' => true, 'note' => 'no payment id' ], 200 );
        }

        // Busca o pagamento na API do MP
        $resp = self::http( 'GET', "/v1/payments/{$payment_id}" );
        if ( ! $resp['ok'] ) {
            // Retorna 200 mesmo assim pra MP não ficar reenviando indefinidamente
            return new WP_REST_Response( [ 'ok' => false, 'error' => $resp['error'] ], 200 );
        }

        $payment = $resp['data'];
        $ext_ref = (string) ( $payment['external_reference'] ?? '' );

        // Acha o pedido por external_reference (WC-{id}) ou metadata
        $order_id = 0;
        if ( str_starts_with( $ext_ref, 'WC-' ) ) {
            $order_id = (int) substr( $ext_ref, 3 );
        }
        if ( ! $order_id && ! empty( $payment['metadata']['wc_order_id'] ) ) {
            $order_id = (int) $payment['metadata']['wc_order_id'];
        }

        $order = $order_id ? wc_get_order( $order_id ) : null;
        if ( ! $order ) {
            return new WP_REST_Response( [ 'ok' => false, 'error' => 'order not found', 'ext_ref' => $ext_ref ], 200 );
        }

        $status        = (string) ( $payment['status'] ?? '' );
        $status_detail = (string) ( $payment['status_detail'] ?? '' );

        $order->update_meta_data( '_mp_payment_id', (string) $payment_id );
        $order->update_meta_data( '_mp_payment_status', $status );
        $order->update_meta_data( '_mp_payment_status_detail', $status_detail );
        $order->save();

        $current = $order->get_status();
        switch ( $status ) {
            case 'approved':
                if ( ! in_array( $current, [ 'processing', 'completed' ], true ) ) {
                    $order->payment_complete( (string) $payment_id );
                    $order->add_order_note( "Webhook MP: pagamento aprovado. payment_id={$payment_id}" );
                }
                break;
            case 'in_process':
            case 'pending':
                if ( ! in_array( $current, [ 'on-hold', 'processing', 'completed' ], true ) ) {
                    $order->update_status( 'on-hold', "Webhook MP: pendente. status_detail={$status_detail}" );
                }
                break;
            case 'rejected':
            case 'cancelled':
                if ( ! in_array( $current, [ 'failed', 'cancelled', 'refunded' ], true ) ) {
                    $order->update_status( $status === 'cancelled' ? 'cancelled' : 'failed',
                        "Webhook MP: {$status}. status_detail={$status_detail}" );
                }
                break;
            case 'refunded':
            case 'charged_back':
                if ( $current !== 'refunded' ) {
                    $order->update_status( 'refunded', "Webhook MP: {$status}." );
                }
                break;
        }

        return new WP_REST_Response( [ 'ok' => true, 'order_id' => $order_id, 'status' => $status ], 200 );
    }
}
