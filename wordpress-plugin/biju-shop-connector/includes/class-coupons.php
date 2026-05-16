<?php
defined( 'ABSPATH' ) || exit;

/**
 * Validação de cupons do WooCommerce para o frontend headless.
 *
 * O carrinho real fica no React, então validamos contra WC_Coupon
 * sem instanciar WC()->cart. Aplicamos as mesmas regras essenciais:
 * existência, expiração, mínimo/máximo, limites de uso, restrição
 * por produto/categoria/e-mail.
 *
 * O desconto final é calculado no servidor no momento da criação
 * do pedido (Biju_Orders), via $order->apply_coupon().
 */
class Biju_Coupons {

    /**
     * POST /biju/v1/coupon/validate
     * Body: { code, subtotal, items: [{ product_id, qty, price }], email? }
     */
    public static function validate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body     = $request->get_json_params();
        $code     = sanitize_text_field( strtolower( trim( $body['code'] ?? '' ) ) );
        $subtotal = (float) ( $body['subtotal'] ?? 0 );
        $items    = is_array( $body['items'] ?? null ) ? $body['items'] : [];
        $email    = sanitize_email( $body['email'] ?? '' );

        if ( ! $code ) {
            return new WP_Error( 'missing_code', 'Informe o código do cupom.', [ 'status' => 400 ] );
        }
        if ( ! class_exists( 'WC_Coupon' ) ) {
            return new WP_Error( 'wc_unavailable', 'WooCommerce indisponível.', [ 'status' => 503 ] );
        }

        $coupon    = new WC_Coupon( $code );
        $coupon_id = $coupon->get_id();
        if ( ! $coupon_id ) {
            return new WP_Error( 'invalid_coupon', 'Cupom inválido.', [ 'status' => 404 ] );
        }

        // Expirado
        $expiry = $coupon->get_date_expires();
        if ( $expiry && $expiry->getTimestamp() < time() ) {
            return new WP_Error( 'expired_coupon', 'Este cupom está expirado.', [ 'status' => 400 ] );
        }

        // Limite global de uso
        $usage_limit = $coupon->get_usage_limit();
        if ( $usage_limit > 0 && $coupon->get_usage_count() >= $usage_limit ) {
            return new WP_Error( 'usage_limit_reached', 'Este cupom atingiu o limite de uso.', [ 'status' => 400 ] );
        }

        // Limite por usuário (precisa de e-mail conhecido)
        $per_user = $coupon->get_usage_limit_per_user();
        if ( $per_user > 0 && $email ) {
            $used_by = (array) $coupon->get_used_by();
            $count   = 0;
            foreach ( $used_by as $u ) {
                if ( is_numeric( $u ) ) {
                    $user = get_user_by( 'id', (int) $u );
                    if ( $user && strcasecmp( $user->user_email, $email ) === 0 ) $count++;
                } elseif ( strcasecmp( (string) $u, $email ) === 0 ) {
                    $count++;
                }
            }
            if ( $count >= $per_user ) {
                return new WP_Error( 'per_user_limit', 'Você já usou este cupom o número máximo de vezes.', [ 'status' => 400 ] );
            }
        }

        // Restrição de e-mail
        $allowed_emails = (array) $coupon->get_email_restrictions();
        if ( $allowed_emails ) {
            $ok = false;
            if ( $email ) {
                foreach ( $allowed_emails as $pattern ) {
                    if ( self::email_matches( $email, (string) $pattern ) ) { $ok = true; break; }
                }
            }
            if ( ! $ok ) {
                return new WP_Error( 'email_restricted', 'Este cupom não está disponível para este e-mail.', [ 'status' => 400 ] );
            }
        }

        // Mínimo / máximo do carrinho (sobre subtotal de itens)
        $min = (float) $coupon->get_minimum_amount();
        if ( $min > 0 && $subtotal < $min ) {
            return new WP_Error(
                'min_amount',
                sprintf( 'Valor mínimo do pedido para este cupom: R$ %s.', number_format( $min, 2, ',', '.' ) ),
                [ 'status' => 400 ]
            );
        }
        $max = (float) $coupon->get_maximum_amount();
        if ( $max > 0 && $subtotal > $max ) {
            return new WP_Error(
                'max_amount',
                sprintf( 'Valor máximo do pedido para este cupom: R$ %s.', number_format( $max, 2, ',', '.' ) ),
                [ 'status' => 400 ]
            );
        }

        // Calcula desconto com base nos itens informados
        $discount = self::calculate_discount( $coupon, $items, $subtotal );
        if ( $discount <= 0 && $coupon->get_discount_type() !== 'free_shipping' ) {
            return new WP_Error(
                'not_applicable',
                'Este cupom não se aplica aos produtos do seu carrinho.',
                [ 'status' => 400 ]
            );
        }

        return new WP_REST_Response( [
            'code'           => $coupon->get_code(),
            'discount_type'  => $coupon->get_discount_type(),
            'amount'         => (float) $coupon->get_amount(),
            'free_shipping'  => (bool) $coupon->get_free_shipping(),
            'discount'       => round( $discount, 2 ),
            'description'    => $coupon->get_description(),
        ], 200 );
    }

    /**
     * Calcula o desconto aplicável dado os itens do carrinho headless.
     * Replica em PHP a lógica do WC para os 3 tipos comuns.
     */
    private static function calculate_discount( WC_Coupon $coupon, array $items, float $subtotal ): float {
        $type    = $coupon->get_discount_type();
        $amount  = (float) $coupon->get_amount();
        $product_ids  = (array) $coupon->get_product_ids();
        $excluded_ids = (array) $coupon->get_excluded_product_ids();
        $cat_ids      = (array) $coupon->get_product_categories();
        $excluded_cat = (array) $coupon->get_excluded_product_categories();

        // free_shipping puro (sem desconto monetário direto)
        if ( $type === 'free_shipping' ) {
            return 0;
        }

        // fixed_cart: desconto direto no subtotal, ignora filtro por produto
        if ( $type === 'fixed_cart' ) {
            return min( $amount, $subtotal );
        }

        // Calcula subtotal elegível (apenas itens compatíveis com restrições)
        $eligible_subtotal = 0;
        $eligible_units    = 0;
        foreach ( $items as $it ) {
            $pid   = (int) ( $it['product_id'] ?? 0 );
            $qty   = (int) ( $it['qty'] ?? 0 );
            $price = (float) ( $it['price'] ?? 0 );
            if ( $pid <= 0 || $qty <= 0 || $price <= 0 ) continue;
            if ( ! self::item_matches_restrictions( $pid, $product_ids, $excluded_ids, $cat_ids, $excluded_cat ) ) continue;
            $eligible_subtotal += $price * $qty;
            $eligible_units    += $qty;
        }

        if ( $eligible_subtotal <= 0 ) return 0;

        if ( $type === 'percent' ) {
            return round( $eligible_subtotal * ( $amount / 100 ), 2 );
        }
        if ( $type === 'fixed_product' ) {
            // valor por unidade elegível
            return round( $amount * $eligible_units, 2 );
        }

        return 0;
    }

    private static function item_matches_restrictions( int $pid, array $allowed_prod, array $excluded_prod, array $allowed_cat, array $excluded_cat ): bool {
        if ( $excluded_prod && in_array( $pid, $excluded_prod, true ) ) return false;
        if ( $allowed_prod && ! in_array( $pid, $allowed_prod, true ) ) {
            // pode ainda passar via categoria — segue checando
            $cats_ok = false;
        } else {
            $cats_ok = true;
        }

        if ( $excluded_cat || $allowed_cat ) {
            $product_cats = wp_get_post_terms( $pid, 'product_cat', [ 'fields' => 'ids' ] );
            if ( is_wp_error( $product_cats ) ) $product_cats = [];

            if ( $excluded_cat && array_intersect( $product_cats, $excluded_cat ) ) return false;
            if ( $allowed_cat && ! array_intersect( $product_cats, $allowed_cat ) ) {
                if ( ! $cats_ok ) return false; // nem produto nem categoria casaram
            }
        }
        return $cats_ok || ( $allowed_cat && ! empty( array_intersect( wp_get_post_terms( $pid, 'product_cat', [ 'fields' => 'ids' ] ) ?: [], $allowed_cat ) ) );
    }

    private static function email_matches( string $email, string $pattern ): bool {
        $email   = strtolower( $email );
        $pattern = strtolower( trim( $pattern ) );
        if ( $pattern === '' ) return false;
        if ( $pattern === $email ) return true;
        // Suporta curingas tipo "*@dominio.com"
        $regex = '/^' . str_replace( '\*', '.*', preg_quote( $pattern, '/' ) ) . '$/i';
        return (bool) preg_match( $regex, $email );
    }
}
