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
        // Number/neighborhood não fazem parte do core do WC — ficam em meta
        // próprio (_billing_number, _billing_neighborhood). Esse é o padrão
        // que plugins BR (Brazilian Market on WooCommerce, NF-e, etiqueta
        // dos Correios, mandabem) leem. Sem isso a etiqueta sai sem bairro
        // e sem número, o que faz os Correios devolverem a encomenda.
        $b_number       = sanitize_text_field( (string) ( $billing['number'] ?? '' ) );
        $b_neighborhood = sanitize_text_field( (string) ( $billing['neighborhood'] ?? '' ) );

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

        if ( $b_number ) {
            $order->update_meta_data( '_billing_number', $b_number );
            $order->update_meta_data( 'billing_number', $b_number );
        }
        if ( $b_neighborhood ) {
            $order->update_meta_data( '_billing_neighborhood', $b_neighborhood );
            $order->update_meta_data( 'billing_neighborhood', $b_neighborhood );
        }

        // Shipping = mesmo que billing se não fornecido
        $shipping = $body['shipping'] ?? $billing;
        $s_number       = sanitize_text_field( (string) ( $shipping['number'] ?? $b_number ) );
        $s_neighborhood = sanitize_text_field( (string) ( $shipping['neighborhood'] ?? $b_neighborhood ) );

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

        if ( $s_number ) {
            $order->update_meta_data( '_shipping_number', $s_number );
            $order->update_meta_data( 'shipping_number', $s_number );
        }
        if ( $s_neighborhood ) {
            $order->update_meta_data( '_shipping_neighborhood', $s_neighborhood );
            $order->update_meta_data( 'shipping_neighborhood', $s_neighborhood );
        }

        // Reserva de carrinho (hold): se este cliente tinha estoque descontado
        // por ter o carrinho salvo, LIBERAMOS agora — o pedido vai reservar e
        // baixar o estoque pelo fluxo normal do Woo logo abaixo. Sem isso,
        // baixaríamos 2x (hold + pedido) e a checagem de estoque abaixo veria o
        // estoque já zerado pela própria reserva do cliente, barrando-o. Liberamos
        // por id da linha do carrinho (cobre user, email e phone).
        if ( class_exists( 'Biju_Stock_Holds' ) && class_exists( 'Biju_Abandoned_Cart' ) ) {
            $b_email  = sanitize_email( $billing['email'] ?? '' );
            $b_phone  = preg_replace( '/\D/', '', sanitize_text_field( $billing['phone'] ?? '' ) );
            $cart_ids = Biju_Abandoned_Cart::find_all_ids( (int) $user_id, $b_email, (string) $b_phone );
            Biju_Stock_Holds::release_for_carts( $cart_ids );
        }

        // Itens do carrinho
        foreach ( (array) $body['items'] as $item ) {
            $product_id   = absint( $item['product_id'] ?? 0 );
            $variation_id = absint( $item['variation_id'] ?? 0 );
            $quantity     = max( 1, absint( $item['quantity'] ?? 1 ) );

            $target_id = $variation_id ?: $product_id;
            $target    = wc_get_product( $target_id );

            if ( ! $target || ! $target->is_in_stock() ) {
                $order->delete( true );
                $nome = $target ? $target->get_name() : "produto #$product_id";
                // `data` estruturado: o front usa product_id/variation_id/available
                // para identificar o item no carrinho e oferecer continuar sem ele,
                // em vez de travar o checkout. Ver handleSubmit em Checkout.tsx.
                return new WP_Error( 'product_unavailable',
                    sprintf( 'Não temos mais "%s" em estoque.', $nome ),
                    [
                        'status'       => 422,
                        'product_id'   => $product_id,
                        'variation_id' => $variation_id,
                        'available'    => 0,
                        'name'         => $nome,
                    ] );
            }

            // Valida a QUANTIDADE pedida contra o estoque disponível. O front já
            // limita, mas isto fecha o caso de estoque que mudou no meio do checkout
            // ou de chamada direta à API. has_enough_stock() já considera
            // managing_stock e backorders, e retorna true quando o produto não
            // gerencia estoque (estoque ilimitado).
            if ( ! $target->has_enough_stock( $quantity ) ) {
                $available     = $target->get_stock_quantity();
                $available_int = is_null( $available ) ? 0 : max( 0, (int) $available );
                $order->delete( true );
                return new WP_Error(
                    'insufficient_stock',
                    sprintf(
                        'Só temos %d unidade(s) de "%s" em estoque.',
                        $available_int,
                        $target->get_name()
                    ),
                    [
                        'status'       => 422,
                        'product_id'   => $product_id,
                        'variation_id' => $variation_id,
                        'available'    => $available_int,
                        'name'         => $target->get_name(),
                    ]
                );
            }

            // Para variações, passar atributos para WC registrar corretamente no item
            $args = [];
            if ( $variation_id && $target instanceof WC_Product_Variation ) {
                $args['variation'] = $target->get_variation_attributes();
            }
            $order->add_product( $target, $quantity, $args );
        }

        // Pagamento — mapeia alias do front para o gateway real (Mercado Pago)
        $payment_method      = sanitize_text_field( $body['payment_method'] );
        $resolved_gateway_id = self::resolve_gateway_id( $payment_method );
        $order->set_payment_method( $resolved_gateway_id );
        $order->set_payment_method_title( self::get_payment_title( $payment_method ) );

        // Frete (método escolhido pelo cliente no front)
        if ( ! empty( $body['shipping_method_id'] ) ) {
            $rate_id     = sanitize_text_field( $body['shipping_method_id'] );
            // Prefere method_id explícito (enviado pelo frontend atualizado via campo 'method_id'
            // da resposta de /shipping/calculate). Sem ele, resolve a partir do rate_id para
            // garantir compatibilidade com frontends antigos que mandam p.ex. 'mandabem-pac0'.
            $method_id   = sanitize_text_field( $body['shipping_method_class'] ?? '' );
            $instance_id = absint( $body['shipping_instance_id'] ?? 0 );

            if ( ! $method_id ) {
                if ( str_contains( $rate_id, ':' ) ) {
                    // Formato WC padrão: 'flat_rate:3'
                    [ $method_id, $inst ] = explode( ':', $rate_id, 2 );
                    $instance_id = (int) $inst;
                } else {
                    // Formato concatenado: 'mandabem-pac0' → method_id='mandabem-pac', instance=0
                    $registered = array_keys( WC()->shipping()->get_shipping_methods() );
                    foreach ( $registered as $reg_id ) {
                        if ( $reg_id !== $rate_id && str_starts_with( $rate_id, $reg_id ) ) {
                            $suffix = substr( $rate_id, strlen( $reg_id ) );
                            if ( is_numeric( $suffix ) ) {
                                $method_id   = $reg_id;
                                $instance_id = (int) $suffix;
                                break;
                            }
                        }
                    }
                    if ( ! $method_id ) {
                        $method_id = $rate_id;
                    }
                }
            }

            $shipping_item = new WC_Order_Item_Shipping();
            $shipping_item->set_method_title( sanitize_text_field( $body['shipping_method_title'] ?? $rate_id ) );
            $shipping_item->set_method_id( $method_id );
            $shipping_item->set_instance_id( $instance_id );
            $shipping_item->set_total( (float) ( $body['shipping_total'] ?? 0 ) );

            // Salva metadados do método de frete (ex: peso/dimensões/prazo do mandabem)
            // para que plugins como mandabem possam gerar etiquetas corretamente.
            if ( is_array( $body['shipping_meta'] ?? null ) ) {
                foreach ( $body['shipping_meta'] as $meta_key => $meta_value ) {
                    if ( is_string( $meta_key ) && is_scalar( $meta_value ) ) {
                        $shipping_item->add_meta_data( sanitize_key( $meta_key ), $meta_value, true );
                    }
                }
            }

            $order->add_item( $shipping_item );
        }

        // Cupom real do WooCommerce — aplica via apply_coupon() para registrar
        // contagem de uso, restrições e refletir no admin como cupom de verdade.
        if ( ! empty( $body['coupon_code'] ) ) {
            $code   = sanitize_text_field( strtolower( trim( $body['coupon_code'] ) ) );
            $result = $order->apply_coupon( $code );
            if ( is_wp_error( $result ) ) {
                $order->delete( true );
                return new WP_Error( 'coupon_failed', $result->get_error_message(), [ 'status' => 400 ] );
            }
        }

        // Desconto manual extra (cupom virtual, ex: PIX 10% — não é cupom WC).
        // Pode coexistir com um coupon_code do WooCommerce.
        if ( ! empty( $body['discount_total'] ) && (float) $body['discount_total'] > 0 ) {
            $fee = new WC_Order_Item_Fee();
            $fee->set_name( sanitize_text_field( $body['discount_title'] ?? 'Desconto' ) );
            $fee->set_amount( -1 * (float) $body['discount_total'] );
            $fee->set_total( -1 * (float) $body['discount_total'] );
            $fee->set_tax_status( 'none' );
            $order->add_item( $fee );
        }

        // Cookies do Meta Pixel (fbp/fbc) para deduplicação CAPI
        if ( ! empty( $body['fbp'] ) ) {
            $order->update_meta_data( '_biju_fbp', sanitize_text_field( $body['fbp'] ) );
        }
        if ( ! empty( $body['fbc'] ) ) {
            $order->update_meta_data( '_biju_fbc', sanitize_text_field( $body['fbc'] ) );
        }
        // URL real do checkout para event_source_url no Purchase CAPI
        if ( ! empty( $body['checkout_url'] ) ) {
            $order->update_meta_data( '_biju_checkout_url', esc_url_raw( $body['checkout_url'] ) );
        }

        // CPF ou CNPJ (meta para nota fiscal e etiqueta de envio).
        // CPF = 11 dígitos, CNPJ = 14. Salvamos em ambos os metas comuns
        // (_billing_cpf, _billing_cnpj) para compat com plugins de NF-e.
        if ( ! empty( $body['cpf'] ) ) {
            $doc = preg_replace( '/\D/', '', $body['cpf'] );
            $is_cnpj = strlen( $doc ) === 14;
            $order->update_meta_data( '_billing_cpf', $doc );
            $order->update_meta_data( '_cpf', $doc );
            if ( $is_cnpj ) {
                $order->update_meta_data( '_billing_cnpj', $doc );
                $order->update_meta_data( '_billing_persontype', '2' );
            } else {
                $order->update_meta_data( '_billing_persontype', '1' );
            }
        }

        // Nota do cliente
        if ( ! empty( $body['customer_note'] ) ) {
            $order->set_customer_note( sanitize_textarea_field( $body['customer_note'] ) );
        }

        // Calcular totais
        $order->calculate_totals();
        $order->set_status( 'pending', 'Pedido recebido via Biju Shop.' );
        $order->save();

        // Reserva de estoque — fecha a corrida de oversell. Precisa vir DEPOIS
        // do save (a reserva referencia o ID do pedido) e ANTES da cobrança: se
        // a última unidade já foi reservada por outro pedido pendente, abortamos
        // sem cobrar. Ver doc de reserve_stock_or_fail().
        $reserve_error = self::reserve_stock_or_fail( $order );
        if ( $reserve_error ) {
            $order->delete( true );
            return $reserve_error;
        }

        // Remove carrinho abandonado — o usuário finalizou o checkout
        if ( $user_id ) {
            global $wpdb;
            $wpdb->delete( $wpdb->prefix . 'wc_abandoned_carts', [ 'user_id' => $user_id ], [ '%d' ] );
        }

        // Dados extras de pagamento (ex: card token vindo do Mercado Pago JS v2)
        $card_payload = is_array( $body['card'] ?? null ) ? $body['card'] : [];

        // Cobra direto via API REST do Mercado Pago (ver Biju_MP_Processor).
        // Não usamos o $gateway->process_payment() do plugin Woo porque ele aborta
        // silenciosamente em chamadas headless (sem checkout nativo) — bug conhecido
        // que resulta em "pedido aprovado sem cobrança real".
        $payment_response = match ( $payment_method ) {
            'credit_card' => Biju_MP_Processor::charge_card( $order, $card_payload ),
            'pix'         => Biju_MP_Processor::charge_pix( $order ),
            'billet'      => Biju_MP_Processor::charge_boleto( $order ),
            default       => [ 'error' => 'unknown_payment_method', 'message' => "Forma de pagamento desconhecida: $payment_method" ],
        };

        // Email "novo pedido" só dispara se o pagamento não falhou na hora.
        // Recarrega o pedido pra pegar o status atualizado pelo processor.
        $order = wc_get_order( $order->get_id() );
        $payment_failed = ! empty( $payment_response['error'] )
            || in_array( $order->get_status(), [ 'failed', 'cancelled' ], true );

        if ( ! $payment_failed ) {
            // PIX/boleto: status on-hold; cartão aprovado: processing.
            // Em todos esses casos o admin precisa saber.
            //
            // NÃO disparamos o e-mail de forma síncrona (->trigger()) porque o
            // SMTP entraria no caminho crítico do checkout — o cliente ficaria
            // esperando o envio do e-mail antes de receber o QR/boleto/resposta.
            // Em vez disso, agendamos o envio em background via Action Scheduler
            // (incluso no WooCommerce). Fallback: WP-Cron single event; e por
            // último o envio síncrono se nenhum agendador estiver disponível.
            self::dispatch_new_order_email( $order->get_id() );
        }

        $response = self::format_order( $order );
        if ( $payment_response ) {
            $response['payment'] = $payment_response;
        }

        return new WP_REST_Response( $response, 201 );
    }

    /**
     * Reserva o estoque dos itens do pedido para fechar a corrida de oversell.
     *
     * Por que isto é necessário no headless:
     *   O estoque do WooCommerce só é BAIXADO quando o pagamento é confirmado
     *   (payment_complete → status processing/completed). Entre a criação do
     *   pedido (pending) e o pagamento — janela que no PIX chega a 10h — vários
     *   clientes podem criar pedidos para a MESMA última unidade, todos passando
     *   na checagem has_enough_stock() (que ainda vê o estoque cheio) e todos
     *   pagando depois → estoque negativo / venda sem estoque.
     *
     *   wc_reserve_stock_for_order() grava uma reserva temporária na tabela
     *   wc_reserved_stock — a MESMA usada pelo checkout nativo. A reserva é
     *   descontada por get_available_stock()/has_enough_stock(), então o 2º
     *   pedido para a última unidade falha AQUI, antes de cobrar.
     *
     * Requisitos no WooCommerce (Ajustes → Produtos → Inventário):
     *   - "Gerir stock?" (woocommerce_manage_stock) = ATIVADO;
     *   - "Manter stock (minutos)" > 0 — define a validade da reserva. Para
     *     cobrir a janela do PIX (10h) o ideal é >= 600. Se ficar vazio/0 a
     *     reserva NÃO é criada (no-op) e o oversell volta a ser possível.
     *
     * Observação: produtos com "Gerir stock?" desmarcado têm estoque ilimitado
     * para o WooCommerce — não são reservados nem limitados aqui. Para esses,
     * o único controle é marcar manualmente "Fora de stock".
     *
     * Retorna WP_Error quando não há estoque disponível (outro pedido reservou),
     * ou null em caso de sucesso / API de reserva indisponível.
     */
    private static function reserve_stock_or_fail( WC_Order $order, bool $renovar = false ): ?WP_Error {
        if ( ! function_exists( 'wc_reserve_stock_for_order' ) ) {
            return null; // WooCommerce < 4.0 — sem API de reserva.
        }
        // Repagamento: se o pedido AINDA tem reserva válida, as unidades já são
        // dele — basta esticar a validade. Não passamos por wc_reserve_stock_for_order()
        // aqui por dois motivos:
        //   1. o SQL do Woo é INSERT ... ON DUPLICATE KEY UPDATE e ele trata
        //      "0 linhas afetadas" como falta de estoque; recriar a reserva dentro
        //      do mesmo segundo não muda `expires`, o MySQL devolve 0 e o cliente
        //      recebe um "produto esgotado" falso;
        //   2. liberar e reservar de novo abriria uma janela em que outro pedido
        //      poderia tomar as unidades que já eram deste cliente.
        if ( $renovar && self::renovar_reserva_existente( $order ) ) {
            return null;
        }
        // Sem reserva válida (expirou ou nunca existiu): limpa linhas velhas e
        // disputa o estoque de novo, com checagem de disponibilidade.
        if ( $renovar && function_exists( 'wc_release_stock_for_order' ) ) {
            wc_release_stock_for_order( $order );
        }
        try {
            wc_reserve_stock_for_order( $order );
        } catch ( \Exception $e ) {
            // ReserveStockException: estoque insuficiente considerando as
            // reservas de outros pedidos pendentes para o mesmo item.
            return new WP_Error(
                'stock_reserved',
                'Um dos itens acabou de esgotar enquanto você finalizava a compra. Revise o carrinho e tente novamente.',
                [ 'status' => 409, 'detail' => $e->getMessage() ]
            );
        }
        return null;
    }

    /**
     * Estica a validade da reserva que o pedido já possui.
     *
     * Retorna true apenas se havia reserva NÃO expirada para o pedido — nesse
     * caso as unidades continuam sendo dele e nenhuma checagem de estoque é
     * necessária. Retorna false quando não há nada a renovar, e aí o chamador
     * precisa disputar o estoque normalmente.
     */
    private static function renovar_reserva_existente( WC_Order $order ): bool {
        global $wpdb;

        $minutos = max( 5, (int) get_option( 'woocommerce_hold_stock_minutes', 20 ) );
        $tabela  = $wpdb->prefix . 'wc_reserved_stock';

        $linhas = (int) $wpdb->query(
            $wpdb->prepare(
                "UPDATE {$tabela} SET `expires` = ( NOW() + INTERVAL %d MINUTE )
                 WHERE `order_id` = %d AND `expires` > NOW()",
                $minutos,
                $order->get_id()
            )
        );

        return $linhas > 0;
    }

    /**
     * Hook usado para enviar o e-mail "novo pedido" em background.
     * Registrado em biju-shop-connector.php (plugins_loaded).
     */
    const NEW_ORDER_EMAIL_HOOK = 'biju_send_new_order_email';

    /**
     * Agenda o envio do e-mail "novo pedido" fora do request do checkout.
     *
     * Ordem de preferência:
     *   1. Action Scheduler (as_enqueue_async_action) — vem com o WooCommerce e
     *      processa em background sem WP-Cron de página.
     *   2. WP-Cron single event imediato — fallback se o Action Scheduler não
     *      estiver carregado por algum motivo.
     *   3. Envio síncrono — só se nenhum agendador existir (não deveria ocorrer
     *      num WooCommerce saudável), para nunca deixar o admin sem aviso.
     */
    private static function dispatch_new_order_email( int $order_id ): void {
        if ( function_exists( 'as_enqueue_async_action' ) ) {
            // Evita duplicar caso, por algum motivo, já exista uma agendada.
            if ( ! function_exists( 'as_has_scheduled_action' )
                || ! as_has_scheduled_action( self::NEW_ORDER_EMAIL_HOOK, [ $order_id ], 'biju-shop' ) ) {
                as_enqueue_async_action( self::NEW_ORDER_EMAIL_HOOK, [ $order_id ], 'biju-shop' );
            }
            return;
        }

        if ( function_exists( 'wp_schedule_single_event' ) ) {
            wp_schedule_single_event( time(), self::NEW_ORDER_EMAIL_HOOK, [ $order_id ] );
            return;
        }

        // Último recurso: envia agora mesmo.
        self::send_new_order_email( $order_id );
    }

    /**
     * Handler do hook agendado: envia de fato o e-mail "novo pedido".
     * Recarrega o mailer porque pode rodar num request/cron separado.
     */
    public static function send_new_order_email( int $order_id ): void {
        if ( ! $order_id || ! function_exists( 'WC' ) ) return;
        $mailer = WC()->mailer();
        if ( ! empty( $mailer->emails['WC_Email_New_Order'] ) ) {
            $mailer->emails['WC_Email_New_Order']->trigger( $order_id );
        }
    }

    /**
     * Mapeia alias do frontend → payment method real instalado.
     * Prioriza gateways do Mercado Pago se estiverem ativos.
     */
    private static function resolve_gateway_id( string $alias ): string {
        $gateways  = WC()->payment_gateways()->payment_gateways();
        $available = array_keys( $gateways );
        $enabled   = [];

        foreach ( $gateways as $id => $gateway ) {
            if ( isset( $gateway->enabled ) && $gateway->enabled === 'yes' ) {
                $enabled[] = $id;
            }
        }

        $map = [
            'pix'         => [ 'woo-mercado-pago-pix' ],
            'billet'      => [ 'woo-mercado-pago-ticket' ],
            'credit_card' => [ 'woo-mercado-pago-custom', 'woo-mercado-pago-basic' ],
        ];

        foreach ( $map[ $alias ] ?? [] as $candidate ) {
            if ( in_array( $candidate, $enabled, true ) ) {
                return $candidate;
            }
        }
        foreach ( $map[ $alias ] ?? [] as $candidate ) {
            if ( in_array( $candidate, $available, true ) ) {
                return $candidate;
            }
        }
        return $alias;
    }

    /**
     * Invoca o process_payment() do gateway (ex: MP PIX)
     * e extrai dados úteis (QR Code, linha digitável, etc.) para o frontend.
     *
     * Para o MP funcionar via REST precisamos:
     *   - Popular $_POST com os campos que o gateway espera (CPF, etc.)
     *   - Garantir que WC()->session esteja inicializada
     */
    private static function trigger_payment_gateway( WC_Order $order, string $gateway_id, array $card_payload = [] ): ?array {
        $gateways = WC()->payment_gateways()->payment_gateways();
        if ( empty( $gateways[ $gateway_id ] ) ) {
            $order->update_status( 'failed', 'Gateway de pagamento nao encontrado via Biju Shop.' );
            return [
                'error'   => 'gateway_not_found',
                'message' => "Gateway $gateway_id não está instalado/ativo.",
                'available' => array_keys( $gateways ),
            ];
        }
        $gateway = $gateways[ $gateway_id ];

        // Garantir sessão WC (process_payment dos gateways assume que existe)
        if ( ! WC()->session ) {
            WC()->initialize_session();
        }
        if ( WC()->session && ! WC()->session->has_session() ) {
            WC()->session->set_customer_session_cookie( true );
        }

        // Garantir cart WC (alguns gateways — incl. MP PIX — chamam WC()->cart->get_cart_contents_total())
        if ( ! WC()->cart ) {
            WC()->initialize_cart();
        }
        if ( WC()->cart ) {
            WC()->cart->empty_cart( false );
            foreach ( $order->get_items() as $item ) {
                /** @var WC_Order_Item_Product $item */
                $product_id   = $item->get_product_id();
                $variation_id = $item->get_variation_id();
                $quantity     = $item->get_quantity();
                if ( $product_id ) {
                    try {
                        WC()->cart->add_to_cart( $product_id, $quantity, $variation_id );
                    } catch ( \Throwable $e ) {
                        // ignore — alguns produtos podem ter restrições; total no pedido já está correto
                    }
                }
            }
            WC()->cart->calculate_totals();
        }

        // Customer WC (alguns gateways leem WC()->customer)
        if ( ! WC()->customer ) {
            WC()->customer = new WC_Customer( get_current_user_id(), true );
        }
        if ( WC()->customer ) {
            WC()->customer->set_billing_email( $order->get_billing_email() );
            WC()->customer->set_billing_first_name( $order->get_billing_first_name() );
            WC()->customer->set_billing_last_name( $order->get_billing_last_name() );
            WC()->customer->set_billing_country( $order->get_billing_country() ?: 'BR' );
            WC()->customer->set_billing_postcode( $order->get_billing_postcode() );
        }

        // Dados do comprador (o MP PIX lê CPF/CNPJ do $_POST)
        $cpf   = $order->get_meta( '_billing_cpf' ) ?: $order->get_meta( '_cpf' ) ?: '';
        // CPF tem 11 dígitos, CNPJ tem 14. Mercado Pago aceita os dois tipos.
        $doc_type = strlen( $cpf ) === 14 ? 'CNPJ' : 'CPF';
        $first = $order->get_billing_first_name();
        $last  = $order->get_billing_last_name();
        $email = $order->get_billing_email();
        $phone = $order->get_billing_phone();

        // Popula $_POST com chaves aceitas por versões diferentes do plugin MP
        $payer_fields = [
            'mercadopago_pix[doc_number]'          => $cpf,
            'mercadopago_pix[doc_type]'            => $doc_type,
            'mercadopago_pix[payer_first_name]'    => $first,
            'mercadopago_pix[payer_last_name]'     => $last,
            'mercadopago_pix[payer_email]'         => $email,
            'mercadopago_custom[doc_number]'       => $cpf,
            'mercadopago_custom[doc_type]'         => $doc_type,
            'mercadopago_ticket[doc_number]'       => $cpf,
            'mercadopago_ticket[doc_type]'         => $doc_type,
            'billing_cpf'                          => $cpf,
            'billing_phone'                        => $phone,
            'billing_email'                        => $email,
        ];
        foreach ( $payer_fields as $k => $v ) {
            if ( $v !== '' && ! isset( $_POST[ $k ] ) ) {
                $_POST[ $k ] = $v;
            }
        }
        // Também em formato array (algumas versões do MP parseiam como array)
        $_POST['mercadopago_pix'] = array_merge( $_POST['mercadopago_pix'] ?? [], [
            'doc_number'       => $cpf,
            'doc_type'         => $doc_type,
            'payer_first_name' => $first,
            'payer_last_name'  => $last,
            'payer_email'      => $email,
        ] );

        // Boleto (ticket) — MP exige dados completos do pagador + endereço
        $_POST['mercadopago_ticket'] = array_merge( $_POST['mercadopago_ticket'] ?? [], [
            'doc_number'       => $cpf,
            'doc_type'         => $doc_type,
            'payer_first_name' => $first,
            'payer_last_name'  => $last,
            'payer_email'      => $email,
            'address'          => $order->get_billing_address_1(),
            'number'           => $order->get_meta( '_billing_number' ) ?: '',
            'city'             => $order->get_billing_city(),
            'state'            => $order->get_billing_state(),
            'zipcode'          => $order->get_billing_postcode(),
            'amount'           => $order->get_total(),
            'payment_method_id' => 'bolbradesco',
        ] );

        // Cartão de crédito — token gerado no frontend via Mercado Pago JS v2
        if ( ! empty( $card_payload['token'] ) ) {
            self::populate_credit_card_post( $order, $card_payload, $cpf, $doc_type, $email );
        }

        // Reproduz os hooks que WC_Checkout::process_checkout dispara antes do
        // process_payment, para que plugins (incluindo o MP) ajustem o pedido.
        $checkout_data = self::build_checkout_data_array( $order );
        do_action( 'woocommerce_checkout_create_order', $order, $checkout_data );
        $order->save();
        do_action( 'woocommerce_checkout_order_created', $order );
        do_action( 'woocommerce_checkout_order_processed', $order->get_id(), $checkout_data, $order );

        self::log_gateway_call( $gateway_id, $order, $card_payload );

        $gateway_result = null;
        try {
            if ( method_exists( $gateway, 'process_payment' ) ) {
                $gateway_result = $gateway->process_payment( $order->get_id() );
            }
        } catch ( \Throwable $e ) {
            self::log_gateway_response( $gateway_id, $order, [ 'exception' => $e->getMessage() ] );
            $order->add_order_note( 'Falha ao processar gateway: ' . $e->getMessage() );
            $order->update_status( 'failed', 'Falha ao processar gateway via Biju Shop.' );
            return [ 'error' => 'gateway_failed', 'message' => $e->getMessage() ];
        }

        self::log_gateway_response( $gateway_id, $order, $gateway_result );

        // Recarregar pedido para ler metas recém-gravadas pelo gateway
        $order = wc_get_order( $order->get_id() );
        $metas = $order->get_meta_data();

        $data = self::extract_payment_data_from_order( $order );

        // Boleto: o MP retorna a URL externa em $gateway_result['redirect']
        // (e em alguns casos também em ['external_resource_url']).
        if ( is_array( $gateway_result ) ) {
            $candidate_urls = [
                $gateway_result['redirect']               ?? '',
                $gateway_result['external_resource_url']  ?? '',
                $gateway_result['result']['external_resource_url'] ?? '',
            ];
            foreach ( $candidate_urls as $u ) {
                if ( empty( $data['boleto_url'] ) && is_string( $u ) && preg_match( '#^https?://#i', $u ) && ! preg_match( '#/checkout/#i', $u ) ) {
                    $data['boleto_url'] = $u;
                    break;
                }
            }
        }

        // Detecta pagamento por cartão (não espera QR/boleto)
        $is_card = ! empty( $card_payload['token'] )
            || in_array( $gateway_id, [ 'woo-mercado-pago-custom', 'woo-mercado-pago-basic' ], true );

        // Resultado explícito do gateway
        $result_status = is_array( $gateway_result ) ? ( $gateway_result['result'] ?? '' ) : '';
        $order_status  = $order->get_status();
        $payment_failed = $result_status === 'failure'
            || in_array( $order_status, [ 'failed', 'cancelled' ], true );

        if ( $payment_failed ) {
            // Tenta extrair motivo da recusa das metas/notes do pedido
            $reason = '';
            foreach ( $metas as $meta ) {
                if ( preg_match( '/status_detail|rejection|cause|_used_gateway_response/i', $meta->key ) ) {
                    $val = is_scalar( $meta->value ) ? (string) $meta->value : json_encode( $meta->value );
                    if ( $val && $val !== 'accredited' ) { $reason = $val; break; }
                }
            }
            if ( $order_status !== 'failed' ) {
                $order->update_status( 'failed', 'Pagamento recusado pelo gateway via Biju Shop.' );
            }
            return [
                'error'   => 'payment_rejected',
                'message' => $reason ?: 'Pagamento recusado. Verifique os dados do cartão e tente novamente, ou escolha outro meio de pagamento.',
                'status'  => $order_status,
            ];
        }

        // Cartão: o gateway pode retornar result=success silenciosamente sem
        // ter feito uma cobrança real (credencial sandbox em produção, falha
        // ao popular $_POST esperado pelo plugin MP, gateway resolvido errado,
        // etc.). Só consideramos aprovado se tivermos prova material:
        //   - um payment_id/transaction_id do Mercado Pago gravado nas metas
        //   - E um status_detail compatível com cobrança aceita
        //   - OU o pedido transicionou para processing/completed/on-hold
        if ( $is_card ) {
            $mp_payment_id = '';
            $status_detail = '';
            foreach ( $metas as $meta ) {
                $key = strtolower( (string) $meta->key );
                $val = is_scalar( $meta->value ) ? (string) $meta->value : '';
                if ( ! $val ) continue;
                if ( $mp_payment_id === '' && preg_match( '/(payment_id|transaction_id|mp_payment|mercadopago.*id)$/i', $key ) ) {
                    if ( ctype_digit( $val ) && strlen( $val ) >= 8 ) {
                        $mp_payment_id = $val;
                    }
                }
                if ( $status_detail === '' && preg_match( '/status_detail/i', $key ) ) {
                    $status_detail = strtolower( $val );
                }
            }

            $accepted_details = [ 'accredited', 'pending_capture', 'partially_refunded', 'in_process', 'pending_contingency', 'pending_review_manual' ];
            $status_ok = in_array( $order->get_status(), [ 'processing', 'completed', 'on-hold' ], true );
            $detail_ok = $status_detail === '' || in_array( $status_detail, $accepted_details, true );
            $payment_proven = $mp_payment_id !== '' && $detail_ok;

            if ( ! $payment_proven && ! $status_ok ) {
                $order->add_order_note( sprintf(
                    'Cartão recusado/não cobrado: payment_id="%s", status_detail="%s", order_status=%s. Bloqueado pelo Biju Shop por falta de prova de cobrança.',
                    $mp_payment_id,
                    $status_detail,
                    $order->get_status()
                ) );
                $order->update_status( 'failed', 'Pagamento por cartão sem confirmação do Mercado Pago.' );
                return [
                    'error'   => 'card_not_charged',
                    'message' => $status_detail
                        ? 'Pagamento recusado pelo emissor. Tente outro cartão ou escolha PIX/boleto.'
                        : 'Não foi possível confirmar a cobrança no cartão. Tente novamente ou escolha outro meio de pagamento.',
                    'status_detail' => $status_detail,
                ];
            }

            return $data;
        }

        // Para PIX/boleto, a ausência de QR/URL indica erro de configuração do gateway
        if ( empty( $data['qr_code_base64'] ) && empty( $data['qr_code'] ) && empty( $data['boleto_url'] ) ) {
            $all_metas = [];
            foreach ( $metas as $meta ) {
                $val = $meta->value;
                $all_metas[ $meta->key ] = is_scalar( $val )
                    ? ( strlen( (string) $val ) > 200 ? substr( (string) $val, 0, 200 ) . '…' : (string) $val )
                    : '(non-scalar)';
            }
            return [
                'error'          => 'payment_data_not_found',
                'message'        => 'Não foi possível gerar o pagamento. Tente novamente em instantes ou escolha outro meio de pagamento.',
                'gateway_id'     => $gateway_id,
                'gateway_result' => $gateway_result,
                'metas'          => $all_metas,
            ];
        }

        return $data;
    }

    private static function get_mp_session_id(): string {
        if ( ! empty( $_POST['mercadopago_custom']['session_id'] ) ) {
            return sanitize_text_field( $_POST['mercadopago_custom']['session_id'] );
        }

        return function_exists( 'wp_generate_uuid4' )
            ? wp_generate_uuid4()
            : uniqid( 'biju_mp_', true );
    }

    /**
     * Popula $_POST['mercadopago_custom'] com TODAS as chaves que o gateway
     * WoocommerceMercadoPagoCustomGateway (v7+) lê em process_payment().
     *
     * O MP plugin mistura snake_case e camelCase entre versões — enviamos as
     * duas formas para garantir compatibilidade. Esta é a estrutura que o
     * checkout real do Woo entrega quando o usuário paga com cartão.
     *
     * Campos esperados em $card_payload (do frontend, gerados pelo MP JS v2):
     *   token, payment_method_id, installments, issuer_id, holder_name,
     *   bin (ou first_six_digits), last_four_digits, expiration_month,
     *   expiration_year, installments_amount, total_paid_amount
     */
    private static function populate_credit_card_post( WC_Order $order, array $card_payload, string $cpf, string $doc_type, string $email ): void {
        $token             = sanitize_text_field( $card_payload['token'] );
        $payment_method_id = sanitize_text_field( $card_payload['payment_method_id'] ?? '' );
        $installments      = max( 1, (int) ( $card_payload['installments'] ?? 1 ) );
        $issuer_id         = sanitize_text_field( $card_payload['issuer_id'] ?? '' );
        $holder_name       = sanitize_text_field( $card_payload['holder_name'] ?? $card_payload['cardholder_name'] ?? '' );
        $bin               = sanitize_text_field( $card_payload['bin'] ?? $card_payload['first_six_digits'] ?? '' );
        $last_four         = sanitize_text_field( $card_payload['last_four_digits'] ?? '' );
        $exp_month         = sanitize_text_field( (string) ( $card_payload['expiration_month'] ?? '' ) );
        $exp_year          = sanitize_text_field( (string) ( $card_payload['expiration_year'] ?? '' ) );
        $amount            = (float) $order->get_total();
        $session_id        = self::get_mp_session_id();
        $installment_amt   = isset( $card_payload['installments_amount'] )
            ? (float) $card_payload['installments_amount']
            : round( $amount / $installments, 2 );
        $total_paid        = isset( $card_payload['total_paid_amount'] )
            ? (float) $card_payload['total_paid_amount']
            : $amount;

        $fields = [
            // Identificação do cartão
            'token'                => $token,
            'payment_method_id'    => $payment_method_id,
            'payment_type_id'      => 'credit_card',
            'issuer'               => $issuer_id,

            // Parcelamento e valores
            'installments'         => $installments,
            'installments_amount'  => $installment_amt,
            'total_paid_amount'    => $total_paid,
            'amount'               => $amount,
            'currency_ratio'       => 1,
            'discount'             => 0,
            'campaign_id'          => '',

            // Titular (chaves duplicadas: MP v7 lê camelCase, v6 lê snake_case)
            'card_holder_name'     => $holder_name,
            'cardholderName'       => $holder_name,
            'cardExpirationMonth'  => $exp_month,
            'cardExpirationYear'   => $exp_year,
            'cardFirstSixDigits'   => $bin,
            'cardLastFourDigits'   => $last_four,

            // Documento (CPF ou CNPJ) — várias chaves para cobrir versões
            'doc_type'             => $doc_type,
            'doc_number'           => $cpf,
            'cpf'                  => $cpf,

            // Pagador
            'payer_email'          => $email,

            // Antifraude (device_id do MP Security JS)
            'session_id'           => $session_id,

            // Tipo de checkout
            'checkout_type'        => 'custom',
        ];

        $_POST['mercadopago_custom'] = array_merge( $_POST['mercadopago_custom'] ?? [], $fields );

        // Campos planos (mercadopago_custom[xxx]) para versões antigas que
        // não fazem parse do array
        foreach ( $fields as $key => $value ) {
            $_POST[ "mercadopago_custom[$key]" ] = $value;
        }

        // Session ID também no namespace do MP Security
        $_POST['mercadopago_checkout_session'] = array_merge( $_POST['mercadopago_checkout_session'] ?? [], [
            'session_id' => $session_id,
        ] );

        // Salva metadados úteis no pedido (para auditoria/reembolso)
        $order->update_meta_data( '_biju_mp_card_bin', $bin );
        $order->update_meta_data( '_biju_mp_card_last4', $last_four );
        $order->update_meta_data( '_biju_mp_installments', $installments );
        $order->update_meta_data( '_biju_mp_session_id', $session_id );
        $order->save();
    }

    /**
     * Monta o array que o WC_Checkout passa para os hooks de criação de pedido.
     * Reproduz o formato esperado por plugins que escutam esses hooks.
     */
    private static function build_checkout_data_array( WC_Order $order ): array {
        return [
            'payment_method'      => $order->get_payment_method(),
            'shipping_method'     => $order->get_shipping_methods(),
            'billing_first_name'  => $order->get_billing_first_name(),
            'billing_last_name'   => $order->get_billing_last_name(),
            'billing_email'       => $order->get_billing_email(),
            'billing_phone'       => $order->get_billing_phone(),
            'billing_address_1'   => $order->get_billing_address_1(),
            'billing_address_2'   => $order->get_billing_address_2(),
            'billing_city'        => $order->get_billing_city(),
            'billing_state'       => $order->get_billing_state(),
            'billing_postcode'    => $order->get_billing_postcode(),
            'billing_country'     => $order->get_billing_country(),
            'shipping_first_name' => $order->get_shipping_first_name(),
            'shipping_last_name'  => $order->get_shipping_last_name(),
            'shipping_address_1'  => $order->get_shipping_address_1(),
            'shipping_address_2'  => $order->get_shipping_address_2(),
            'shipping_city'       => $order->get_shipping_city(),
            'shipping_state'      => $order->get_shipping_state(),
            'shipping_postcode'   => $order->get_shipping_postcode(),
            'shipping_country'    => $order->get_shipping_country(),
            'order_comments'      => $order->get_customer_note(),
        ];
    }

    /**
     * Loga (em WooCommerce → Status → Logs, source: biju-mp) o que estamos
     * enviando ao gateway. Token e CPF são mascarados para não vazar PCI/LGPD.
     */
    private static function log_gateway_call( string $gateway_id, WC_Order $order, array $card_payload ): void {
        if ( ! function_exists( 'wc_get_logger' ) ) return;

        $masked = $card_payload;
        if ( ! empty( $masked['token'] ) ) {
            $masked['token'] = substr( $masked['token'], 0, 6 ) . '…' . substr( $masked['token'], -4 );
        }

        $post_snapshot = $_POST['mercadopago_custom'] ?? [];
        if ( ! empty( $post_snapshot['token'] ) ) {
            $post_snapshot['token'] = substr( $post_snapshot['token'], 0, 6 ) . '…';
        }
        if ( ! empty( $post_snapshot['doc_number'] ) ) {
            $post_snapshot['doc_number'] = '***' . substr( $post_snapshot['doc_number'], -3 );
        }

        wc_get_logger()->info(
            sprintf(
                "[order #%d] → %s\ncard_payload: %s\n\$_POST[mercadopago_custom]: %s",
                $order->get_id(),
                $gateway_id,
                wp_json_encode( $masked, JSON_UNESCAPED_UNICODE ),
                wp_json_encode( $post_snapshot, JSON_UNESCAPED_UNICODE )
            ),
            [ 'source' => 'biju-mp' ]
        );
    }

    /**
     * Loga o que o gateway retornou (resultado e status do pedido) para
     * facilitar diagnóstico de recusas/erros.
     */
    private static function log_gateway_response( string $gateway_id, WC_Order $order, $result ): void {
        if ( ! function_exists( 'wc_get_logger' ) ) return;

        $order = wc_get_order( $order->get_id() ); // recarrega para pegar metas pós-gateway
        $relevant_metas = [];
        foreach ( $order->get_meta_data() as $meta ) {
            if ( preg_match( '/mercadopago|mp_|status_detail|rejection/i', $meta->key ) ) {
                $val = $meta->value;
                $relevant_metas[ $meta->key ] = is_scalar( $val )
                    ? (string) $val
                    : ( is_array( $val ) || is_object( $val ) ? wp_json_encode( $val ) : '(?)' );
            }
        }

        wc_get_logger()->info(
            sprintf(
                "[order #%d] ← %s\nresult: %s\norder_status: %s\nrelevant_metas: %s",
                $order->get_id(),
                $gateway_id,
                wp_json_encode( $result, JSON_UNESCAPED_UNICODE ),
                $order->get_status(),
                wp_json_encode( $relevant_metas, JSON_UNESCAPED_UNICODE )
            ),
            [ 'source' => 'biju-mp' ]
        );
    }

    /**
     * Lê metas do pedido e extrai dados de pagamento (QR Code PIX, boleto, etc.)
     * Usado tanto na criação do pedido quanto ao listar pedidos do cliente.
     */
    private static function extract_payment_data_from_order( WC_Order $order ): array {
        $data = [];
        foreach ( $order->get_meta_data() as $meta ) {
            $key = strtolower( $meta->key );
            $val = $meta->value;

            if ( ! is_scalar( $val ) ) {
                $json = is_array( $val ) || is_object( $val ) ? json_encode( $val ) : '';
                if ( $json && empty( $data['qr_code_base64'] ) && preg_match( '/"qr_code_base64"\s*:\s*"([^"]+)"/', $json, $m ) ) {
                    $data['qr_code_base64'] = $m[1];
                }
                if ( $json && empty( $data['qr_code'] ) && preg_match( '/"qr_code"\s*:\s*"([^"]+)"/', $json, $m ) ) {
                    $data['qr_code'] = $m[1];
                }
                continue;
            }

            $sval = (string) $val;

            if ( empty( $data['qr_code_base64'] ) && preg_match( '/qr.?code.?base.?64|pix.?qr.?base/i', $key ) ) {
                $data['qr_code_base64'] = $sval;
            }
            if ( empty( $data['qr_code'] ) && preg_match( '/pix.?qr.?code|pix_copy_paste|qr_code$/i', $key ) ) {
                if ( strlen( $sval ) > 30 && ! str_starts_with( $sval, 'data:image' ) && ! preg_match( '#^[A-Za-z0-9+/=]{200,}$#', $sval ) ) {
                    $data['qr_code'] = $sval;
                }
            }
            if ( empty( $data['expires_at'] ) && preg_match( '/expiration|validade|due_date/i', $key ) ) {
                $data['expires_at'] = $sval;
            }
            if ( empty( $data['boleto_url'] ) && preg_match( '/(ticket|billet|boleto).*url|pdf/i', $key ) ) {
                $data['boleto_url'] = $sval;
            }
            if ( empty( $data['boleto_barcode'] ) && preg_match( '/(ticket|billet|boleto).*(barcode|linha)/i', $key ) ) {
                $data['boleto_barcode'] = $sval;
            }
        }
        return $data;
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

        // CPF só sai para o dono autenticado (ou admin) — pedidos de convidado
        // (customer_id=0) são legíveis por ID, então não vazamos o documento.
        $is_owner = $user_id && $order->get_customer_id() === $user_id;
        $include_private = $is_owner || current_user_can( 'manage_woocommerce' );

        return new WP_REST_Response( self::format_order( $order, $include_private ), 200 );
    }

    /**
     * POST /biju/v1/orders/{id}/pay
     *
     * Regera o pagamento de um pedido que ainda está aguardando pagamento
     * (pending / on-hold / failed). Usado pelo botão "Pagar agora" na conta do
     * cliente — quando o pedido foi criado mas o pagamento não foi concluído.
     *
     * Body: { "payment_method": "pix" | "credit_card" | "billet", "card"?: {...} }
     *
     * Acesso: somente o dono do pedido (ou um admin). Cobra o total que já está
     * gravado no pedido — não recalcula desconto de PIX nem mexe nos itens, para
     * nunca alterar silenciosamente o valor que o cliente deve.
     */
    public static function pay_order( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $order_id = (int) $request->get_param( 'id' );
        $order    = wc_get_order( $order_id );
        if ( ! $order ) {
            return new WP_Error( 'not_found', 'Pedido não encontrado.', [ 'status' => 404 ] );
        }

        // Auth — só o dono (ou admin) pode disparar o pagamento.
        $user_id = Biju_Auth::get_user_from_request( $request );
        $is_admin = current_user_can( 'manage_woocommerce' );
        if ( ! $user_id && ! $is_admin ) {
            return new WP_Error( 'unauthorized', 'Faça login para pagar este pedido.', [ 'status' => 401 ] );
        }
        if ( $order->get_customer_id() && $order->get_customer_id() !== $user_id && ! $is_admin ) {
            return new WP_Error( 'forbidden', 'Acesso negado.', [ 'status' => 403 ] );
        }

        // Só pedidos que ainda estão aguardando pagamento podem ser cobrados de novo.
        if ( ! in_array( $order->get_status(), [ 'pending', 'on-hold', 'failed' ], true ) ) {
            return new WP_Error( 'not_payable', 'Este pedido não está mais aguardando pagamento.', [ 'status' => 409 ] );
        }

        // Reservar o estoque DE NOVO antes de cobrar. A reserva criada quando o
        // pedido nasceu já expirou (woocommerce_hold_stock_minutes), então neste
        // ponto o item pode ter sido vendido para outra pessoa. Sem isto, o
        // cliente pagaria um pedido que a loja não consegue atender e o estoque
        // iria a negativo na baixa. wc_reserve_stock_for_order() ignora a reserva
        // do próprio pedido, então chamar de novo apenas renova a validade.
        $reserve_error = self::reserve_stock_or_fail( $order, true );
        if ( $reserve_error ) {
            return $reserve_error; // 409 — diferente da criação, aqui NÃO apagamos o pedido.
        }

        $body           = $request->get_json_params() ?: [];
        $payment_method = sanitize_text_field( $body['payment_method'] ?? 'pix' );
        $card_payload   = is_array( $body['card'] ?? null ) ? $body['card'] : [];

        // Reflete a forma de pagamento escolhida agora no pedido.
        $order->set_payment_method( self::resolve_gateway_id( $payment_method ) );
        $order->set_payment_method_title( self::get_payment_title( $payment_method ) );
        $order->save();

        $payment_response = match ( $payment_method ) {
            'credit_card' => Biju_MP_Processor::charge_card( $order, $card_payload ),
            'pix'         => Biju_MP_Processor::charge_pix( $order ),
            'billet'      => Biju_MP_Processor::charge_boleto( $order ),
            default       => [ 'error' => 'unknown_payment_method', 'message' => "Forma de pagamento desconhecida: $payment_method" ],
        };

        // Recarrega para refletir o status atualizado pelo processador.
        $order = wc_get_order( $order->get_id() );
        $response = self::format_order( $order, true ); // dono já verificado acima
        $response['payment'] = $payment_response;

        return new WP_REST_Response( $response, 200 );
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

        // include_private=true: são os pedidos do próprio usuário autenticado.
        return new WP_REST_Response(
            array_map( static fn ( WC_Order $o ) => self::format_order( $o, true ), $orders ),
            200
        );
    }

    // -------------------------------------------------------------------------

    /**
     * @param bool $include_private Inclui dados sensíveis (CPF/CNPJ) no payload.
     *                              Só deve ser true quando o requester é o dono
     *                              verificado do pedido (ou admin) — nunca em
     *                              rotas que servem pedidos de convidado por ID.
     */
    public static function format_order( WC_Order $order, bool $include_private = false ): array {
        $items = [];
        foreach ( $order->get_items() as $item ) {
            $product  = $item->get_product();
            $quantity = (int) $item->get_quantity();
            $total    = (float) $item->get_total();
            $items[] = [
                'product_id' => $item->get_product_id(),
                'name'       => $item->get_name(),
                'quantity'   => $quantity,
                'price'      => $quantity > 0 ? $total / $quantity : $total,
                'total'      => $total,
                'image'      => $product ? wp_get_attachment_url( $product->get_image_id() ) : null,
            ];
        }

        $data = [
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
            'payment'        => self::get_payment_for_pending_order( $order ),
        ];

        // CPF/CNPJ só vai no payload para o dono verificado (usado pelo front
        // para tokenizar o cartão em "Pagar agora"). Nunca em pedidos servidos
        // por ID a convidados, para não vazar documento (LGPD).
        if ( $include_private ) {
            $data['cpf'] = preg_replace( '/\D/', '', (string) ( $order->get_meta( '_billing_cpf' ) ?: $order->get_meta( '_cpf' ) ?: '' ) );
        }

        return $data;
    }

    /**
     * Retorna dados de pagamento (QR PIX / boleto) apenas se o pedido ainda
     * estiver aguardando pagamento. Evita vazar QR expirado em pedidos já pagos.
     */
    private static function get_payment_for_pending_order( WC_Order $order ): ?array {
        if ( ! in_array( $order->get_status(), [ 'pending', 'on-hold' ], true ) ) {
            return null;
        }
        $data = self::extract_payment_data_from_order( $order );
        return $data ?: null;
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
