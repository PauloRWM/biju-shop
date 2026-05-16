<?php
defined( 'ABSPATH' ) || exit;

/**
 * Handlers de pedidos.
 */
class Biju_Orders {

    /**
     * POST /biju/v1/orders
     *
     * Body esperado:
     * {
     *   "billing": { "first_name", "last_name", "email", "phone", "address_1", "city", "state", "postcode" },
     *   "items":   [ { "product_id": 123, "quantity": 1 } ],
     *   "payment_method": "pix|billet|credit_card",
     *   "customer_note": ""
     * }
     */
    public static function create_order( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();

        // Validação mínima
        $required = [ 'billing', 'items', 'payment_method' ];
        foreach ( $required as $field ) {
            if ( empty( $body[ $field ] ) ) {
                return new WP_Error( 'missing_field', "Campo obrigatório: $field", [ 'status' => 400 ] );
            }
        }

        $billing = $body['billing'];
        $email_required = [ 'first_name', 'last_name', 'email' ];
        foreach ( $email_required as $field ) {
            if ( empty( $billing[ $field ] ) ) {
                return new WP_Error( 'missing_billing', "Billing obrigatório: $field", [ 'status' => 400 ] );
            }
        }

        // Criar pedido
        $order = wc_create_order();
        if ( is_wp_error( $order ) ) {
            return new WP_Error( 'order_failed', 'Erro ao criar pedido.', [ 'status' => 500 ] );
        }

        // Vincular ao usuário autenticado (opcional)
        $user_id = Biju_Auth::get_user_from_request( $request );
        if ( $user_id ) {
            $order->set_customer_id( $user_id );
        }

        // Billing
        $order->set_address( [
            'first_name' => sanitize_text_field( $billing['first_name'] ?? '' ),
            'last_name'  => sanitize_text_field( $billing['last_name'] ?? '' ),
            'email'      => sanitize_email( $billing['email'] ?? '' ),
            'phone'      => sanitize_text_field( $billing['phone'] ?? '' ),
            'address_1'  => sanitize_text_field( $billing['address_1'] ?? '' ),
            'address_2'  => sanitize_text_field( $billing['address_2'] ?? '' ),
            'city'       => sanitize_text_field( $billing['city'] ?? '' ),
            'state'      => sanitize_text_field( $billing['state'] ?? '' ),
            'postcode'   => sanitize_text_field( $billing['postcode'] ?? '' ),
            'country'    => sanitize_text_field( $billing['country'] ?? 'BR' ),
        ], 'billing' );

        // Shipping = mesmo que billing se não fornecido
        $shipping = $body['shipping'] ?? $billing;
        $order->set_address( [
            'first_name' => sanitize_text_field( $shipping['first_name'] ?? '' ),
            'last_name'  => sanitize_text_field( $shipping['last_name'] ?? '' ),
            'address_1'  => sanitize_text_field( $shipping['address_1'] ?? '' ),
            'address_2'  => sanitize_text_field( $shipping['address_2'] ?? '' ),
            'city'       => sanitize_text_field( $shipping['city'] ?? '' ),
            'state'      => sanitize_text_field( $shipping['state'] ?? '' ),
            'postcode'   => sanitize_text_field( $shipping['postcode'] ?? '' ),
            'country'    => sanitize_text_field( $shipping['country'] ?? 'BR' ),
        ], 'shipping' );

        // Itens do carrinho
        foreach ( (array) $body['items'] as $item ) {
            $product_id = absint( $item['product_id'] ?? 0 );
            $quantity   = absint( $item['quantity'] ?? 1 );
            $product    = wc_get_product( $product_id );

            if ( ! $product || ! $product->is_in_stock() ) {
                $order->delete( true );
                return new WP_Error( 'product_unavailable',
                    "Produto $product_id indisponível.", [ 'status' => 422 ] );
            }

            $order->add_product( $product, $quantity );
        }

        // Pagamento
        $payment_method = sanitize_text_field( $body['payment_method'] );
        $order->set_payment_method( $payment_method );
        $order->set_payment_method_title( self::get_payment_title( $payment_method ) );

        // Nota do cliente
        if ( ! empty( $body['customer_note'] ) ) {
            $order->set_customer_note( sanitize_textarea_field( $body['customer_note'] ) );
        }

        // Calcular totais
        $order->calculate_totals();
        $order->set_status( 'pending', 'Pedido recebido via Biju Shop.' );
        $order->save();

        // Enviar email de confirmação
        WC()->mailer()->emails['WC_Email_New_Order']->trigger( $order->get_id() );

        return new WP_REST_Response( self::format_order( $order ), 201 );
    }

    /**
     * GET /biju/v1/orders/{id}
     */
    public static function get_order( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $order_id = (int) $request->get_param( 'id' );
        $order    = wc_get_order( $order_id );

        if ( ! $order ) {
            return new WP_Error( 'not_found', 'Pedido não encontrado.', [ 'status' => 404 ] );
        }

        // Verificar permissão: token do dono ou admin
        $user_id = Biju_Auth::get_user_from_request( $request );
        if ( $order->get_customer_id() && $order->get_customer_id() !== $user_id ) {
            if ( ! current_user_can( 'manage_woocommerce' ) ) {
                return new WP_Error( 'forbidden', 'Acesso negado.', [ 'status' => 403 ] );
            }
        }

        return new WP_REST_Response( self::format_order( $order ), 200 );
    }

    /**
     * GET /biju/v1/account/orders
     */
    public static function get_customer_orders( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $user_id = Biju_Auth::get_user_from_request( $request );
        if ( ! $user_id ) {
            return new WP_Error( 'unauthorized', 'Token inválido.', [ 'status' => 401 ] );
        }

        $orders = wc_get_orders( [
            'customer_id' => $user_id,
            'limit'       => 20,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ] );

        return new WP_REST_Response( array_map( [ __CLASS__, 'format_order' ], $orders ), 200 );
    }

    // -------------------------------------------------------------------------

    public static function format_order( WC_Order $order ): array {
        $items = [];
        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            $items[] = [
                'product_id' => $item->get_product_id(),
                'name'       => $item->get_name(),
                'quantity'   => $item->get_quantity(),
                'price'      => (float) $item->get_total() / $item->get_quantity(),
                'total'      => (float) $item->get_total(),
                'image'      => $product ? wp_get_attachment_url( $product->get_image_id() ) : null,
            ];
        }

        return [
            'id'             => $order->get_id(),
            'status'         => $order->get_status(),
            'statusLabel'    => wc_get_order_status_name( $order->get_status() ),
            'total'          => (float) $order->get_total(),
            'subtotal'       => (float) $order->get_subtotal(),
            'paymentMethod'  => $order->get_payment_method(),
            'paymentTitle'   => $order->get_payment_method_title(),
            'items'          => $items,
            'billing'        => [
                'name'    => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'email'   => $order->get_billing_email(),
                'phone'   => $order->get_billing_phone(),
                'address' => $order->get_billing_address_1(),
                'city'    => $order->get_billing_city(),
                'state'   => $order->get_billing_state(),
                'postcode' => $order->get_billing_postcode(),
            ],
            'createdAt'      => $order->get_date_created()?->date( 'c' ),
            'customerNote'   => $order->get_customer_note(),
        ];
    }

    private static function get_payment_title( string $method ): string {
        return match ( $method ) {
            'pix'         => 'PIX',
            'billet'      => 'Boleto Bancário',
            'credit_card' => 'Cartão de Crédito',
            default       => ucfirst( $method ),
        };
    }
}
