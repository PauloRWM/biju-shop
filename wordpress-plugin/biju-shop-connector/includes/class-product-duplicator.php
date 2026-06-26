<?php
defined( 'ABSPATH' ) || exit;

/**
 * Duplicador de produtos em massa (por linha).
 *
 * Adiciona um botão "⧉ Duplicar" nas ações de CADA produto na listagem
 * (Produtos → Todos). Ao clicar, um modal pergunta apenas QUANTAS cópias e já
 * duplica, reusando o duplicador nativo do WooCommerce (wc_get_product_duplicate).
 *
 * As cópias são criadas como rascunho (draft), igual ao "Duplicar" nativo.
 */
class Biju_Product_Duplicator {

    const ACTION = 'biju_duplicate_product';
    const NONCE  = 'biju_duplicate_product_nonce';
    const MAX    = 50; // teto de cópias por clique (evita travar o servidor)

    public static function init() {
        // Botão nas ações de linha de cada produto (sempre presente no DOM).
        add_filter( 'post_row_actions', [ __CLASS__, 'add_row_action' ], 10, 2 );

        // AJAX que faz a duplicação.
        add_action( 'wp_ajax_' . self::ACTION, [ __CLASS__, 'ajax_duplicate' ] );

        // JS + CSS + modal — só na tela de listagem de produtos.
        add_action( 'admin_footer-edit.php', [ __CLASS__, 'print_assets' ] );
    }

    /**
     * Adiciona o link "⧉ Duplicar" nas ações de cada linha de produto.
     */
    public static function add_row_action( $actions, $post ) {
        if ( $post->post_type !== 'product' || ! current_user_can( 'manage_woocommerce' ) ) {
            return $actions;
        }
        $actions['biju_duplicate'] = sprintf(
            '<a href="#" class="biju-dup-link" data-product-id="%d" data-product-name="%s" style="color:#7c3aed;font-weight:700;">⧉ Duplicar</a>',
            (int) $post->ID,
            esc_attr( get_the_title( $post ) )
        );
        return $actions;
    }

    /**
     * Handler AJAX: duplica o produto N vezes.
     */
    public static function ajax_duplicate() {
        check_ajax_referer( self::NONCE, 'nonce' );

        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_send_json_error( [ 'message' => 'Permissão negada.' ] );
        }
        if ( ! function_exists( 'wc_get_product' ) ) {
            wp_send_json_error( [ 'message' => 'WooCommerce indisponível.' ] );
        }

        // Caminho base do WooCommerce. WC_ABSPATH existe quando o WC está
        // carregado; senão deriva do diretório de plugins.
        $wc_path = defined( 'WC_ABSPATH' ) ? WC_ABSPATH : WP_PLUGIN_DIR . '/woocommerce/';

        // wc_get_product_duplicate() vive em wc-admin-functions.php, que NÃO é
        // carregado em chamadas admin-ajax.php. Inclui manualmente se necessário.
        if ( ! function_exists( 'wc_get_product_duplicate' ) ) {
            $admin_functions = $wc_path . 'includes/wc-admin-functions.php';
            if ( file_exists( $admin_functions ) ) {
                include_once $admin_functions;
            }
        }

        // Fallback final: se ainda não existir, usa o duplicador da classe de admin.
        $duplicator = null;
        if ( ! function_exists( 'wc_get_product_duplicate' ) ) {
            $dup_class = $wc_path . 'includes/admin/class-wc-admin-duplicate-product.php';
            if ( file_exists( $dup_class ) ) {
                include_once $dup_class;
            }
            if ( class_exists( 'WC_Admin_Duplicate_Product' ) ) {
                $duplicator = new WC_Admin_Duplicate_Product();
            }
        }

        if ( ! function_exists( 'wc_get_product_duplicate' ) && ! $duplicator ) {
            wp_send_json_error( [ 'message' => 'Função de duplicação do WooCommerce não encontrada.' ] );
        }

        $product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
        $copies     = isset( $_POST['copies'] ) ? absint( $_POST['copies'] ) : 0;

        if ( ! $product_id ) {
            wp_send_json_error( [ 'message' => 'Produto inválido.' ] );
        }
        if ( $copies < 1 ) {
            wp_send_json_error( [ 'message' => 'Informe um número de cópias maior que zero.' ] );
        }
        if ( $copies > self::MAX ) {
            wp_send_json_error( [ 'message' => 'Máximo de ' . self::MAX . ' cópias por vez.' ] );
        }

        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            wp_send_json_error( [ 'message' => 'Produto não encontrado.' ] );
        }

        $created = 0;
        $errors  = 0;
        for ( $i = 0; $i < $copies; $i++ ) {
            try {
                if ( function_exists( 'wc_get_product_duplicate' ) ) {
                    $duplicate = wc_get_product_duplicate( $product );
                } else {
                    // Fallback via classe de admin do Woo.
                    $duplicate = $duplicator->product_duplicate( $product );
                }
                if ( $duplicate && ! is_wp_error( $duplicate ) ) {
                    $created++;
                } else {
                    $errors++;
                }
            } catch ( \Throwable $e ) {
                $errors++;
            }
        }

        if ( $created === 0 ) {
            wp_send_json_error( [ 'message' => 'Nenhuma cópia foi criada. Tente novamente.' ] );
        }

        wp_send_json_success( [
            'created' => $created,
            'errors'  => $errors,
            'message' => sprintf(
                '%d cópia(s) criada(s) como rascunho.%s',
                $created,
                $errors ? ' ' . $errors . ' falharam.' : ''
            ),
        ] );
    }

    /**
     * Modal + JS + CSS. Só imprime na tela de listagem de produtos.
     */
    public static function print_assets() {
        $screen = get_current_screen();
        if ( ! $screen || $screen->id !== 'edit-product' ) {
            return;
        }
        $nonce = wp_create_nonce( self::NONCE );
        ?>
        <style>
            /* Deixa o link "Duplicar" sempre visível (não só no hover da linha). */
            .wp-list-table.posts .row-actions .biju_duplicate { display:inline !important; }
            .wp-list-table.posts tr .row-actions { visibility:visible; }
            /* Modal */
            #biju-dup-overlay {
                position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:100000;
                display:none; align-items:center; justify-content:center;
            }
            #biju-dup-modal {
                background:#fff; border-radius:10px; padding:26px 28px; width:380px; max-width:92vw;
                box-shadow:0 10px 40px rgba(0,0,0,.3); font-size:14px;
            }
            #biju-dup-modal h2 { margin:0 0 6px; font-size:18px; }
            #biju-dup-modal p.sub { margin:0 0 16px; color:#666; }
            #biju-dup-modal input[type=number] {
                width:100%; height:44px; font-size:18px; text-align:center;
                border:1px solid #8c8f94; border-radius:6px; margin-bottom:18px;
            }
            #biju-dup-actions { display:flex; gap:10px; justify-content:flex-end; }
            #biju-dup-modal .button-primary { background:#7c3aed; border-color:#6d28d9; }
            #biju-dup-modal.busy * { pointer-events:none; opacity:.7; }
        </style>

        <div id="biju-dup-overlay">
            <div id="biju-dup-modal">
                <h2>Duplicar produto</h2>
                <p class="sub" id="biju-dup-product">—</p>
                <input type="number" id="biju-dup-copies" min="1" max="<?php echo (int) self::MAX; ?>" value="1" />
                <div id="biju-dup-actions">
                    <button type="button" class="button" id="biju-dup-cancel">Cancelar</button>
                    <button type="button" class="button button-primary" id="biju-dup-confirm">Duplicar</button>
                </div>
            </div>
        </div>

        <script>
        (function($){
            var $overlay = $('#biju-dup-overlay');
            var $modal   = $('#biju-dup-modal');
            var $copies  = $('#biju-dup-copies');
            var current  = { id:0 };

            function open(id, name){
                current.id = id;
                $('#biju-dup-product').text(name || ('Produto #' + id));
                $copies.val(1);
                $overlay.css('display','flex');
                $modal.removeClass('busy');
                setTimeout(function(){ $copies.trigger('focus').trigger('select'); }, 50);
            }
            function close(){ $overlay.hide(); current.id = 0; }

            function confirm(){
                var copies = parseInt($copies.val(), 10);
                if (isNaN(copies) || copies < 1) { alert('Informe um número válido (1 ou mais).'); return; }
                if (copies > <?php echo (int) self::MAX; ?>) { alert('Máximo de <?php echo (int) self::MAX; ?> cópias.'); return; }

                $modal.addClass('busy');
                $('#biju-dup-confirm').text('Duplicando...');

                $.ajax({
                    url: ajaxurl, type:'POST',
                    data: {
                        action: '<?php echo esc_js( self::ACTION ); ?>',
                        nonce: '<?php echo esc_js( $nonce ); ?>',
                        product_id: current.id,
                        copies: copies
                    },
                    success: function(res){
                        if (res && res.success) {
                            window.location.reload();
                        } else {
                            alert('Erro: ' + (res && res.data ? res.data.message : 'desconhecido'));
                            $modal.removeClass('busy');
                            $('#biju-dup-confirm').text('Duplicar');
                        }
                    },
                    error: function(){
                        alert('Erro de conexão. Tente novamente.');
                        $modal.removeClass('busy');
                        $('#biju-dup-confirm').text('Duplicar');
                    }
                });
            }

            // Abre o modal pelo link da linha.
            $(document).on('click', '.biju-dup-link', function(e){
                e.preventDefault();
                open($(this).data('product-id'), $(this).data('product-name'));
            });
            $('#biju-dup-confirm').on('click', confirm);
            $('#biju-dup-cancel').on('click', close);
            $overlay.on('click', function(e){ if (e.target === this) close(); });
            // Enter confirma, Esc cancela.
            $copies.on('keydown', function(e){
                if (e.key === 'Enter') { e.preventDefault(); confirm(); }
                if (e.key === 'Escape') close();
            });
        })(jQuery);
        </script>
        <?php
    }
}
