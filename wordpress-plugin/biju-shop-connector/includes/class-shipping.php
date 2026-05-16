<?php
/**
 * Cálculo de frete via WooCommerce Shipping Zones / Methods.
 *
 * Endpoint público: POST biju/v1/shipping/calculate
 * Body: {
 *   postcode: "01001-000",
 *   items: [ { product_id, quantity, variation_id? } ]
 * }
 *
 * Resposta: { methods: [ { id, title, cost, etaDays, description } ] }
 */
defined( 'ABSPATH' ) || exit;

class Biju_Shipping {

    public static function register_routes(): void {
        register_rest_route( BIJU_API_NAMESPACE, '/shipping/calculate', [
            'methods'             => 'POST',
            'callback'            => [ self::class, 'calculate' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public static function calculate( WP_REST_Request $req ) {
        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) ) {
            return new WP_REST_Response( [ 'methods' => [] ], 200 );
        }

        $body     = $req->get_json_params() ?: [];
        $postcode = preg_replace( '/\D/', '', (string) ( $body['postcode'] ?? '' ) );
        $items    = is_array( $body['items'] ?? null ) ? $body['items'] : [];

        if ( strlen( $postcode ) !== 8 ) {
            return new WP_REST_Response( [
                'error'   => 'invalid_postcode',
                'message' => 'CEP inválido.',
                'methods' => [],
            ], 400 );
        }

        // Monta os contents do pacote a partir dos itens do frontend
        $contents      = [];
        $contents_cost = 0.0;
        foreach ( $items as $i => $item ) {
            $product_id   = absint( $item['product_id'] ?? 0 );
            $variation_id = absint( $item['variation_id'] ?? 0 );
            $quantity     = max( 1, absint( $item['quantity'] ?? 1 ) );
            if ( ! $product_id ) continue;

            $product = wc_get_product( $variation_id ?: $product_id );
            if ( ! $product ) continue;

            $price = (float) $product->get_price();
            $line_total = $price * $quantity;
            $contents_cost += $line_total;

            $contents[ 'item_' . $i ] = [
                'product_id'   => $product_id,
                'variation_id' => $variation_id,
                'variation'    => [],
                'quantity'     => $quantity,
                'data'         => $product,
                'data_hash'    => '',
                'line_total'   => $line_total,
                'line_subtotal'=> $line_total,
            ];
        }

        // Fallback: se subtotal foi enviado e não há produtos, usa direto (não dá pra calcular peso)
        if ( ! $contents && isset( $body['subtotal'] ) ) {
            $contents_cost = (float) $body['subtotal'];
        }

        // Garantir que WC esteja inicializado
        if ( ! WC()->session )  WC()->initialize_session();
        if ( ! WC()->customer ) WC()->customer = new WC_Customer( 0, true );

        WC()->customer->set_shipping_country( 'BR' );
        WC()->customer->set_shipping_postcode( $postcode );
        WC()->customer->set_billing_country( 'BR' );
        WC()->customer->set_billing_postcode( $postcode );

        $package = [
            'contents'        => $contents,
            'contents_cost'   => $contents_cost,
            'applied_coupons' => [],
            'user'            => [ 'ID' => get_current_user_id() ],
            'destination'     => [
                'country'   => 'BR',
                'state'     => '',
                'postcode'  => $postcode,
                'city'      => '',
                'address'   => '',
                'address_2' => '',
            ],
        ];

        $zone    = WC_Shipping_Zones::get_zone_matching_package( $package );
        $methods = $zone ? $zone->get_shipping_methods( true ) : [];

        $rates = [];
        foreach ( $methods as $method ) {
            // Calcula taxas para o pacote — a maioria dos métodos populam $method->rates
            if ( method_exists( $method, 'calculate_shipping' ) ) {
                $method->rates = [];
                try {
                    $method->calculate_shipping( $package );
                } catch ( \Throwable $e ) {
                    continue;
                }
            }
            if ( ! empty( $method->rates ) && is_array( $method->rates ) ) {
                foreach ( $method->rates as $rate ) {
                    if ( ! $rate ) continue;
                    $rates[] = self::format_rate( $rate, $method );
                }
            } elseif ( method_exists( $method, 'get_rates_for_package' ) ) {
                $list = $method->get_rates_for_package( $package );
                if ( is_array( $list ) ) {
                    foreach ( $list as $rate ) {
                        $rates[] = self::format_rate( $rate, $method );
                    }
                }
            }
        }

        return new WP_REST_Response( [ 'methods' => $rates ], 200 );
    }

    private static function format_rate( $rate, $method ): array {
        $cost  = (float) ( method_exists( $rate, 'get_cost' ) ? $rate->get_cost() : ( $rate->cost ?? 0 ) );
        $taxes = method_exists( $rate, 'get_shipping_taxes' ) ? (array) $rate->get_shipping_taxes() : [];
        $cost += array_sum( array_map( 'floatval', $taxes ) );

        $id    = method_exists( $rate, 'get_id' )    ? $rate->get_id()    : ( $rate->id    ?? '' );
        $label = method_exists( $rate, 'get_label' ) ? $rate->get_label() : ( $rate->label ?? '' );

        // Coleta todos os metadados escalares da taxa (necessário para o mandabem salvar
        // peso/dimensões/prazo no shipping item do pedido ao criar via API headless).
        $all_meta = [];
        if ( method_exists( $rate, 'get_meta_data' ) ) {
            foreach ( (array) $rate->get_meta_data() as $k => $v ) {
                if ( is_string( $k ) && is_scalar( $v ) ) {
                    $all_meta[ $k ] = $v;
                }
            }
        } elseif ( property_exists( $rate, 'meta_data' ) && is_array( $rate->meta_data ) ) {
            foreach ( $rate->meta_data as $k => $v ) {
                if ( is_string( $k ) && is_scalar( $v ) ) {
                    $all_meta[ $k ] = $v;
                }
            }
        }

        // Extrai prazo dos metadados
        $eta = '';
        foreach ( $all_meta as $k => $v ) {
            if ( preg_match( '/eta|prazo|delivery|forecast|days/i', $k ) ) {
                $eta = (string) $v;
                if ( $eta ) break;
            }
        }

        // Normaliza prazo numérico para "X dias úteis"
        if ( $eta && is_numeric( $eta ) ) {
            $eta = ( (int) $eta ) . ' dias úteis';
        }

        // method_id é o ID da classe do método (ex: 'mandabem-pac'), distinto do rate ID
        // (ex: 'mandabem-pac0' que concatena instance_id). O WC_Order_Item_Shipping deve
        // usar method_id, não o rate ID — mandabem usa o method_id para mapear o serviço.
        $method_id_str  = method_exists( $rate, 'get_method_id' )   ? (string) $rate->get_method_id()   : (string) $id;
        $instance_id_int = method_exists( $rate, 'get_instance_id' ) ? (int)    $rate->get_instance_id() : 0;

        return [
            'id'          => (string) $id,
            'method_id'   => $method_id_str,
            'instance_id' => $instance_id_int,
            'title'       => (string) $label,
            'cost'        => round( $cost, 2 ),
            'etaDays'     => $eta,
            'description' => '',
            'meta'        => $all_meta,
        ];
    }
}
