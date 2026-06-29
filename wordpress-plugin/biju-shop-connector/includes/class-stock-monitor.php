<?php
defined( 'ABSPATH' ) || exit;

/**
 * Monitor de estoque — página de admin para acompanhar rapidamente o estoque
 * dos produtos WooCommerce (simples e variações) em um só lugar.
 *
 * Foco em itens que GERENCIAM estoque (_manage_stock = yes), que são os únicos
 * sujeitos a oversell. Ordena do menor estoque para o maior, com cores e filtros
 * (sem estoque / estoque baixo / em estoque) e busca por nome ou SKU.
 */
class Biju_Stock_Monitor {

    /** Itens por página da tabela. */
    const PER_PAGE = 50;

    /** Limite padrão de "estoque baixo" caso o Woo não tenha um configurado. */
    const DEFAULT_LOW = 5;

    /** Limite a partir do qual o estoque é considerado "baixo". */
    private static function low_threshold(): int {
        $woo = (int) get_option( 'woocommerce_notify_low_stock_amount', 0 );
        return $woo > 0 ? $woo : self::DEFAULT_LOW;
    }

    public static function render_page(): void {
        if ( ! current_user_can( 'manage_woocommerce' ) && ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Sem permissão.', 'biju' ) );
        }

        global $wpdb;

        $low    = self::low_threshold();
        $filter = isset( $_GET['stock_filter'] ) ? sanitize_key( wp_unslash( $_GET['stock_filter'] ) ) : 'all';
        $search = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : '';
        $paged  = isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1;
        $offset = ( $paged - 1 ) * self::PER_PAGE;

        // ── Cards-resumo (consultas COUNT enxutas sobre itens que gerenciam estoque) ──
        $base_join = "
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} ms ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
            LEFT JOIN {$wpdb->postmeta} st ON st.post_id = p.ID AND st.meta_key = '_stock'
            WHERE p.post_status = 'publish' AND p.post_type IN ('product','product_variation')
        ";

        $total_managed = (int) $wpdb->get_var( "SELECT COUNT(*) {$base_join}" );
        $count_out     = (int) $wpdb->get_var( "SELECT COUNT(*) {$base_join} AND ( st.meta_value IS NULL OR CAST(st.meta_value AS SIGNED) <= 0 )" );
        $count_low     = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) {$base_join} AND CAST(st.meta_value AS SIGNED) > 0 AND CAST(st.meta_value AS SIGNED) <= %d",
            $low
        ) );
        $count_ok = max( 0, $total_managed - $count_out - $count_low );

        // ── Monta a query da listagem conforme filtro + busca ──
        $where  = " AND 1=1";
        $params = [];

        if ( 'out' === $filter ) {
            $where .= " AND ( st.meta_value IS NULL OR CAST(st.meta_value AS SIGNED) <= 0 )";
        } elseif ( 'low' === $filter ) {
            $where   .= " AND CAST(st.meta_value AS SIGNED) > 0 AND CAST(st.meta_value AS SIGNED) <= %d";
            $params[] = $low;
        } elseif ( 'instock' === $filter ) {
            $where   .= " AND CAST(st.meta_value AS SIGNED) > %d";
            $params[] = $low;
        }

        // LEFT JOIN para nome do produto pai (variações) e SKU, usados na busca.
        $search_join = "
            LEFT JOIN {$wpdb->posts} par ON par.ID = p.post_parent
            LEFT JOIN {$wpdb->postmeta} sku ON sku.post_id = p.ID AND sku.meta_key = '_sku'
        ";
        if ( '' !== $search ) {
            $like     = '%' . $wpdb->esc_like( $search ) . '%';
            $where   .= " AND ( p.post_title LIKE %s OR par.post_title LIKE %s OR sku.meta_value LIKE %s )";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $list_from = "
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} ms ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock' AND ms.meta_value = 'yes'
            LEFT JOIN {$wpdb->postmeta} st ON st.post_id = p.ID AND st.meta_key = '_stock'
            {$search_join}
            WHERE p.post_status = 'publish' AND p.post_type IN ('product','product_variation') {$where}
        ";

        // Total filtrado (para paginação).
        $count_sql = "SELECT COUNT(DISTINCT p.ID) {$list_from}";
        $found     = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) ) : $wpdb->get_var( $count_sql ) );

        // IDs da página, do menor estoque pro maior (NULL = sem estoque definido, vem antes).
        $list_sql      = "SELECT DISTINCT p.ID {$list_from} ORDER BY CAST(st.meta_value AS SIGNED) ASC, p.ID ASC LIMIT %d OFFSET %d";
        $list_params   = array_merge( $params, [ self::PER_PAGE, $offset ] );
        $ids           = $wpdb->get_col( $wpdb->prepare( $list_sql, $list_params ) );

        $total_pages = (int) ceil( $found / self::PER_PAGE );

        // Helper para montar URLs de filtro/busca preservando o resto.
        $base_url = menu_page_url( 'biju-stock', false );
        $make_url = function ( array $args ) use ( $base_url, $filter, $search ) {
            $args = array_merge( [ 'stock_filter' => $filter, 's' => $search ], $args );
            $args = array_filter( $args, fn( $v ) => '' !== $v && null !== $v );
            return esc_url( add_query_arg( $args, $base_url ) );
        };
        ?>
        <div class="wrap">
            <h1 style="display:flex;align-items:center;gap:10px">
                <span class="dashicons dashicons-products" style="font-size:28px;width:28px;height:28px"></span>
                Estoque dos Produtos
            </h1>
            <p class="description">
                Itens que controlam estoque no WooCommerce, do menor para o maior.
                "Estoque baixo" = <strong><?php echo (int) $low; ?></strong> unidades ou menos
                (<a href="<?php echo esc_url( admin_url( 'admin.php?page=wc-settings&tab=products&section=inventory' ) ); ?>">ajustar limite</a>).
            </p>

            <!-- ── Cards-resumo ── -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin:18px 0">
                <?php
                $cards = [
                    [ 'all', 'Gerenciam estoque', $total_managed, '#2271b1', '#f0f6fc' ],
                    [ 'out', 'Sem estoque',       $count_out,     '#d63638', '#fcf0f1' ],
                    [ 'low', 'Estoque baixo',      $count_low,     '#bd8600', '#fcf9e8' ],
                    [ 'instock', 'Em estoque OK',  $count_ok,      '#007017', '#edfaef' ],
                ];
                foreach ( $cards as $c ) :
                    [ $fkey, $label, $value, $color, $bg ] = $c;
                    $active = ( $filter === $fkey );
                    ?>
                    <a href="<?php echo $make_url( [ 'stock_filter' => $fkey, 'paged' => false ] ); ?>"
                       style="flex:1;min-width:160px;text-decoration:none;border:2px solid <?php echo $active ? $color : 'transparent'; ?>;background:<?php echo esc_attr( $bg ); ?>;border-radius:8px;padding:14px 16px;display:block">
                        <div style="font-size:13px;color:#50575e;font-weight:600"><?php echo esc_html( $label ); ?></div>
                        <div style="font-size:28px;font-weight:700;color:<?php echo esc_attr( $color ); ?>;line-height:1.2"><?php echo (int) $value; ?></div>
                    </a>
                <?php endforeach; ?>
            </div>

            <!-- ── Busca ── -->
            <form method="get" style="margin:12px 0">
                <input type="hidden" name="page" value="biju-stock">
                <input type="hidden" name="stock_filter" value="<?php echo esc_attr( $filter ); ?>">
                <p class="search-box">
                    <input type="search" name="s" value="<?php echo esc_attr( $search ); ?>" placeholder="Buscar por nome ou SKU…" style="width:280px">
                    <input type="submit" class="button" value="Buscar">
                    <?php if ( '' !== $search ) : ?>
                        <a href="<?php echo $make_url( [ 's' => false, 'paged' => false ] ); ?>" class="button">Limpar</a>
                    <?php endif; ?>
                </p>
            </form>

            <p class="description"><?php echo (int) $found; ?> item(ns) encontrado(s)<?php echo $search ? ' para "' . esc_html( $search ) . '"' : ''; ?>.</p>

            <!-- ── Tabela ── -->
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width:48px"></th>
                        <th>Produto</th>
                        <th style="width:140px">SKU</th>
                        <th style="width:120px">Estoque</th>
                        <th style="width:120px">Situação</th>
                        <th style="width:120px">Preço</th>
                        <th style="width:90px"></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if ( empty( $ids ) ) : ?>
                        <tr><td colspan="7" style="padding:24px;text-align:center;color:#50575e">Nenhum item para este filtro.</td></tr>
                    <?php else : ?>
                        <?php foreach ( $ids as $id ) :
                            $product = wc_get_product( (int) $id );
                            if ( ! $product ) continue;

                            $qty       = $product->get_stock_quantity();
                            $qty_known = ( null !== $qty && '' !== $qty );
                            $qty_int   = $qty_known ? (int) $qty : 0;

                            if ( $qty_int <= 0 ) {
                                $color = '#d63638'; $sit = 'Sem estoque'; $sit_bg = '#fcf0f1';
                            } elseif ( $qty_int <= $low ) {
                                $color = '#bd8600'; $sit = 'Baixo'; $sit_bg = '#fcf9e8';
                            } else {
                                $color = '#007017'; $sit = 'OK'; $sit_bg = '#edfaef';
                            }

                            // Variações editam-se na tela do produto pai.
                            $edit_id  = $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id();
                            $edit_url = get_edit_post_link( $edit_id );
                            $img      = $product->get_image( [ 40, 40 ] );
                            ?>
                            <tr>
                                <td><?php echo $img; // já escapado pelo Woo ?></td>
                                <td>
                                    <strong><?php echo esc_html( $product->get_name() ); ?></strong>
                                    <?php if ( $product->is_type( 'variation' ) ) : ?>
                                        <span style="color:#787c82;font-size:11px"> (variação)</span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo esc_html( $product->get_sku() ?: '—' ); ?></td>
                                <td>
                                    <span style="font-size:18px;font-weight:700;color:<?php echo esc_attr( $color ); ?>">
                                        <?php echo $qty_known ? (int) $qty_int : '—'; ?>
                                    </span>
                                </td>
                                <td>
                                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:<?php echo esc_attr( $color ); ?>;background:<?php echo esc_attr( $sit_bg ); ?>">
                                        <?php echo esc_html( $sit ); ?>
                                    </span>
                                </td>
                                <td><?php echo wp_kses_post( $product->get_price_html() ?: '—' ); ?></td>
                                <td>
                                    <?php if ( $edit_url ) : ?>
                                        <a href="<?php echo esc_url( $edit_url ); ?>" class="button button-small">Editar</a>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <!-- ── Paginação ── -->
            <?php if ( $total_pages > 1 ) : ?>
                <div class="tablenav" style="margin-top:12px">
                    <div class="tablenav-pages">
                        <span class="displaying-num"><?php echo (int) $found; ?> itens</span>
                        <span class="pagination-links">
                            <?php if ( $paged > 1 ) : ?>
                                <a class="button" href="<?php echo $make_url( [ 'paged' => $paged - 1 ] ); ?>">‹ Anterior</a>
                            <?php endif; ?>
                            <span style="margin:0 8px">Página <?php echo (int) $paged; ?> de <?php echo (int) $total_pages; ?></span>
                            <?php if ( $paged < $total_pages ) : ?>
                                <a class="button" href="<?php echo $make_url( [ 'paged' => $paged + 1 ] ); ?>">Próxima ›</a>
                            <?php endif; ?>
                        </span>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }
}
