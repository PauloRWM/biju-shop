<?php
defined( 'ABSPATH' ) || exit;

/**
 * Duplicação em massa de produtos WooCommerce.
 *
 * Adiciona botão "Duplicar produtos" na listagem de produtos do admin,
 * abre um modal onde o usuário escolhe quais produtos e quantas cópias,
 * e processa via AJAX com barra de progresso.
 */
class Biju_Duplicate_Products {

    public static function init(): void {
        add_action( 'admin_footer-edit.php',                   [ __CLASS__, 'render_modal' ] );
        add_action( 'admin_enqueue_scripts',                   [ __CLASS__, 'enqueue_assets' ] );
        add_action( 'wp_ajax_biju_duplicate_products',         [ __CLASS__, 'ajax_duplicate' ] );
        add_action( 'wp_ajax_biju_get_products_for_duplicate', [ __CLASS__, 'ajax_get_products' ] );
    }

    // ── Assets ──────────────────────────────────────────────────────────────

    public static function enqueue_assets( string $hook ): void {
        if ( 'edit.php' !== $hook || ( $_GET['post_type'] ?? '' ) !== 'product' ) {
            return;
        }
        // Inline — sem arquivo externo para não complicar o deploy.
        wp_add_inline_style( 'wp-admin', self::css() );
        wp_add_inline_script( 'jquery', self::js() );
    }

    // ── Modal HTML ───────────────────────────────────────────────────────────

    public static function render_modal(): void {
        if ( ( $_GET['post_type'] ?? '' ) !== 'product' ) {
            return;
        }
        ?>
        <!-- Botão fixo na toolbar do WooCommerce -->
        <script>
        (function($){
            $(function(){
                // Injeta botão ao lado do "Adicionar produto"
                var $btn = $('<a>', {
                    id:    'biju-dup-open',
                    href:  '#',
                    class: 'page-title-action biju-dup-trigger',
                    html:  '&#x2398; Duplicar produtos'
                });
                $('.wrap .wp-heading-inline').after($btn);
            });
        })(jQuery);
        </script>

        <!-- Modal overlay -->
        <div id="biju-dup-overlay" style="display:none">
            <div id="biju-dup-modal">
                <button id="biju-dup-close" title="Fechar">&times;</button>
                <h2>&#x2398; Duplicar produtos</h2>

                <!-- Passo 1 — selecionar produtos -->
                <div id="biju-dup-step1">
                    <p class="biju-dup-desc">
                        Escolha os produtos que deseja duplicar e quantas cópias de cada.
                    </p>

                    <div class="biju-dup-search-wrap">
                        <input type="text" id="biju-dup-search"
                               placeholder="&#128269; Buscar produto por nome…" autocomplete="off">
                    </div>

                    <div id="biju-dup-list-wrap">
                        <table id="biju-dup-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" id="biju-dup-check-all" title="Selecionar todos"></th>
                                    <th>Produto</th>
                                    <th>SKU</th>
                                    <th style="width:90px">Cópias</th>
                                </tr>
                            </thead>
                            <tbody id="biju-dup-tbody">
                                <tr><td colspan="4" class="biju-dup-loading">Carregando produtos…</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="biju-dup-footer">
                        <span id="biju-dup-selected-count">0 selecionados</span>
                        <button id="biju-dup-confirm" class="button button-primary" disabled>
                            Duplicar selecionados &#x2192;
                        </button>
                    </div>
                </div>

                <!-- Passo 2 — progresso -->
                <div id="biju-dup-step2" style="display:none">
                    <p id="biju-dup-progress-label">Iniciando…</p>
                    <div class="biju-dup-bar-wrap">
                        <div id="biju-dup-bar"></div>
                    </div>
                    <ul id="biju-dup-log"></ul>
                    <button id="biju-dup-done" class="button button-primary" style="display:none">
                        &#x2713; Concluído — fechar
                    </button>
                </div>
            </div>
        </div>
        <?php
    }

    // ── AJAX: lista produtos para o modal ────────────────────────────────────

    public static function ajax_get_products(): void {
        check_ajax_referer( 'biju_duplicate_products', 'nonce' );

        if ( ! current_user_can( 'edit_products' ) ) {
            wp_send_json_error( 'Permissão negada.', 403 );
        }

        $page = max( 1, (int) ( $_GET['page'] ?? 1 ) );
        $per  = min( 100, max( 10, (int) ( $_GET['per'] ?? 100 ) ) );

        $result = wc_get_products( [
            'status'   => [ 'publish', 'draft', 'private' ],
            'limit'    => $per,
            'page'     => $page,
            'paginate' => true,
            'orderby'  => 'title',
            'order'    => 'ASC',
        ] );

        $products = [];
        foreach ( $result->products as $product ) {
            $products[] = [
                'id'   => $product->get_id(),
                'name' => $product->get_name(),
                'sku'  => $product->get_sku() ?: '—',
            ];
        }

        wp_send_json_success( [
            'products' => $products,
            'more'     => $page < $result->max_num_pages,
        ] );
    }

    // ── AJAX: duplicar produto ────────────────────────────────────────────────

    public static function ajax_duplicate(): void {
        check_ajax_referer( 'biju_duplicate_products', 'nonce' );

        if ( ! current_user_can( 'edit_products' ) ) {
            wp_send_json_error( 'Permissão negada.', 403 );
        }

        $product_id = (int) ( $_POST['product_id'] ?? 0 );
        $copies     = max( 1, min( 50, (int) ( $_POST['copies'] ?? 1 ) ) );

        if ( ! $product_id ) {
            wp_send_json_error( 'ID inválido.' );
        }

        $original = wc_get_product( $product_id );
        if ( ! $original ) {
            wp_send_json_error( 'Produto não encontrado.' );
        }

        // Carrega a classe de duplicação do WooCommerce (só existe na área admin).
        if ( ! class_exists( 'WC_Admin_Duplicate_Product' ) ) {
            $path = WC()->plugin_path() . '/includes/admin/class-wc-admin-duplicate-product.php';
            if ( file_exists( $path ) ) {
                require_once $path;
            } else {
                wp_send_json_error( 'Recurso de duplicação do WooCommerce não encontrado.' );
            }
        }

        $duplicator = new WC_Admin_Duplicate_Product();
        $created    = [];

        for ( $i = 0; $i < $copies; $i++ ) {
            $copy = $duplicator->product_duplicate( $original );
            if ( $copy instanceof WC_Product ) {
                // Marca como rascunho para o usuário revisar antes de publicar.
                $copy->set_status( 'draft' );
                $copy->save();
                $created[] = [
                    'id'    => $copy->get_id(),
                    'title' => $copy->get_name(),
                    'edit'  => get_edit_post_link( $copy->get_id(), 'raw' ),
                ];
            }
        }

        wp_send_json_success( [
            'original' => $original->get_name(),
            'copies'   => $created,
        ] );
    }

    // ── CSS inline ───────────────────────────────────────────────────────────

    private static function css(): string {
        return '
/* ── Botão trigger ── */
.biju-dup-trigger {
    background: #7c3aed !important;
    color: #fff !important;
    border-color: #6d28d9 !important;
    font-weight: 600 !important;
    padding: 4px 14px !important;
    margin-left: 6px !important;
}
.biju-dup-trigger:hover { background: #6d28d9 !important; color:#fff !important; }

/* ── Overlay ── */
#biju-dup-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 99999;
    display: flex; align-items: center; justify-content: center;
}

/* ── Modal ── */
#biju-dup-modal {
    background: #fff;
    border-radius: 10px;
    width: min(860px, 94vw);
    max-height: 88vh;
    overflow: hidden;
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,.35);
    position: relative;
}
#biju-dup-modal h2 {
    margin: 0;
    padding: 20px 24px 14px;
    font-size: 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    color: #1e1b4b;
}
#biju-dup-close {
    position: absolute; top: 14px; right: 18px;
    background: none; border: none;
    font-size: 1.6rem; line-height: 1; cursor: pointer;
    color: #6b7280;
}
#biju-dup-close:hover { color: #111; }

/* ── Step 1 ── */
#biju-dup-step1 { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
.biju-dup-desc { margin: 12px 24px 0; color: #6b7280; font-size: .9rem; }
.biju-dup-search-wrap { padding: 10px 24px; }
#biju-dup-search {
    width: 100%; padding: 8px 12px;
    border: 1px solid #d1d5db; border-radius: 6px; font-size: .95rem;
    box-sizing: border-box;
}
#biju-dup-list-wrap { flex: 1; overflow-y: auto; border-top: 1px solid #f3f4f6; }
#biju-dup-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
#biju-dup-table thead th {
    background: #f9fafb; position: sticky; top: 0; z-index: 1;
    padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;
    font-weight: 600; color: #374151;
}
#biju-dup-table tbody tr:hover { background: #f5f3ff; }
#biju-dup-table tbody tr.selected { background: #ede9fe; }
#biju-dup-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
.biju-dup-loading { text-align: center; color: #9ca3af; padding: 32px !important; }
.biju-copies-input {
    width: 64px; padding: 4px 6px; text-align: center;
    border: 1px solid #d1d5db; border-radius: 4px; font-size: .9rem;
}
.biju-dup-footer {
    padding: 14px 24px;
    border-top: 1px solid #e5e7eb;
    display: flex; align-items: center; justify-content: space-between;
    background: #fff;
}
#biju-dup-selected-count { color: #6b7280; font-size: .9rem; }
#biju-dup-confirm { font-size: .95rem !important; }
#biju-dup-confirm:disabled { opacity: .45; cursor: not-allowed; }

/* ── Step 2 ── */
#biju-dup-step2 { padding: 28px 28px 24px; }
#biju-dup-progress-label { font-weight: 600; margin-bottom: 10px; color: #374151; }
.biju-dup-bar-wrap {
    background: #e5e7eb; border-radius: 999px; height: 18px; overflow: hidden; margin-bottom: 16px;
}
#biju-dup-bar {
    height: 100%; width: 0%;
    background: linear-gradient(90deg,#7c3aed,#a78bfa);
    border-radius: 999px; transition: width .3s ease;
}
#biju-dup-log {
    max-height: 280px; overflow-y: auto;
    list-style: none; margin: 0; padding: 0;
    font-size: .875rem;
}
#biju-dup-log li { padding: 4px 0; border-bottom: 1px solid #f3f4f6; color: #374151; }
#biju-dup-log li.ok::before  { content: "✓ "; color: #16a34a; font-weight: 700; }
#biju-dup-log li.err::before { content: "✗ "; color: #dc2626; font-weight: 700; }
#biju-dup-done { margin-top: 18px; }
';
    }

    // ── JS inline ────────────────────────────────────────────────────────────

    private static function js(): string {
        $nonce    = wp_create_nonce( 'biju_duplicate_products' );
        $ajax_url = admin_url( 'admin-ajax.php' );

        return <<<JS
(function(\$){
    var allProducts = [];
    var nonce    = '{$nonce}';
    var ajaxUrl  = '{$ajax_url}';

    // ── Abrir / fechar modal ─────────────────────────────────────────────
    \$(document).on('click', '#biju-dup-open', function(e){
        e.preventDefault();
        openModal();
    });
    \$(document).on('click', '#biju-dup-close, #biju-dup-done', function(){
        closeModal();
    });
    \$(document).on('click', '#biju-dup-overlay', function(e){
        if (e.target === this) closeModal();
    });
    \$(document).on('keydown', function(e){
        if (e.key === 'Escape') closeModal();
    });

    function openModal() {
        \$('#biju-dup-overlay').fadeIn(180);
        resetToStep1();
        if (!allProducts.length) loadProducts();
    }
    function closeModal() {
        \$('#biju-dup-overlay').fadeOut(150);
    }
    function resetToStep1() {
        \$('#biju-dup-step1').show();
        \$('#biju-dup-step2').hide();
        \$('#biju-dup-bar').css('width','0%');
        \$('#biju-dup-log').empty();
        \$('#biju-dup-done').hide();
        updateCount();
    }

    // ── Carregar produtos via WP REST API ────────────────────────────────
    function loadProducts() {
        \$('#biju-dup-tbody').html('<tr><td colspan="4" class="biju-dup-loading">Carregando produtos…</td></tr>');
        allProducts = [];
        fetchPage(1);
    }
    function fetchPage(page) {
        \$.ajax({
            url: ajaxUrl,
            data: {
                action: 'biju_get_products_for_duplicate',
                nonce:  nonce,
                page:   page,
                per:    100
            },
            success: function(res) {
                if (!res.success) return;
                allProducts = allProducts.concat(res.data.products);
                if (res.data.more) {
                    fetchPage(page + 1);
                } else {
                    renderTable(allProducts);
                }
            },
            error: function() {
                \$('#biju-dup-tbody').html('<tr><td colspan="4" class="biju-dup-loading">Erro ao carregar produtos.</td></tr>');
            }
        });
    }

    function renderTable(products, filter) {
        filter = (filter || '').toLowerCase();
        var html = '';
        products.forEach(function(p) {
            if (filter && p.name.toLowerCase().indexOf(filter) === -1 && p.sku.toLowerCase().indexOf(filter) === -1) return;
            html += '<tr data-id="' + p.id + '">' +
                '<td><input type="checkbox" class="biju-dup-chk" data-id="' + p.id + '"></td>' +
                '<td>' + escHtml(p.name) + '</td>' +
                '<td>' + escHtml(p.sku) + '</td>' +
                '<td><input type="number" class="biju-copies-input" data-id="' + p.id + '" value="1" min="1" max="50"></td>' +
            '</tr>';
        });
        \$('#biju-dup-tbody').html(html || '<tr><td colspan="4" class="biju-dup-loading">Nenhum produto encontrado.</td></tr>');
    }

    // ── Busca em tempo real ───────────────────────────────────────────────
    var searchTimer;
    \$(document).on('input', '#biju-dup-search', function() {
        clearTimeout(searchTimer);
        var q = \$(this).val();
        searchTimer = setTimeout(function(){ renderTable(allProducts, q); }, 200);
    });

    // ── Selecionar / desselecionar ────────────────────────────────────────
    \$(document).on('change', '#biju-dup-check-all', function() {
        \$('.biju-dup-chk').prop('checked', \$(this).is(':checked'));
        \$('.biju-dup-chk').each(function() {
            \$(this).closest('tr').toggleClass('selected', \$(this).is(':checked'));
        });
        updateCount();
    });
    \$(document).on('change', '.biju-dup-chk', function() {
        \$(this).closest('tr').toggleClass('selected', \$(this).is(':checked'));
        updateCount();
    });
    \$(document).on('click', '#biju-dup-table tbody tr', function(e) {
        if (\$(e.target).is('input')) return;
        var \$chk = \$(this).find('.biju-dup-chk');
        \$chk.prop('checked', !\$chk.is(':checked'));
        \$(this).toggleClass('selected', \$chk.is(':checked'));
        updateCount();
    });

    function updateCount() {
        var n = \$('.biju-dup-chk:checked').length;
        \$('#biju-dup-selected-count').text(n + (n === 1 ? ' selecionado' : ' selecionados'));
        \$('#biju-dup-confirm').prop('disabled', n === 0);
    }

    // ── Confirmar e duplicar ─────────────────────────────────────────────
    \$(document).on('click', '#biju-dup-confirm', function() {
        var jobs = [];
        \$('.biju-dup-chk:checked').each(function() {
            var id = \$(this).data('id');
            var copies = parseInt(\$('.biju-copies-input[data-id=' + id + ']').val(), 10) || 1;
            jobs.push({ id: id, copies: copies });
        });
        if (!jobs.length) return;

        \$('#biju-dup-step1').hide();
        \$('#biju-dup-step2').show();
        processJobs(jobs);
    });

    function processJobs(jobs) {
        var total = jobs.length;
        var done  = 0;

        function next() {
            if (!jobs.length) {
                \$('#biju-dup-progress-label').text('Concluído! ' + done + ' produto(s) duplicado(s).');
                \$('#biju-dup-bar').css('width','100%');
                \$('#biju-dup-done').show();
                return;
            }
            var job = jobs.shift();
            var pct = Math.round((done / total) * 100);
            \$('#biju-dup-bar').css('width', pct + '%');
            \$('#biju-dup-progress-label').text('Duplicando produto ' + (done + 1) + ' de ' + total + '…');

            \$.ajax({
                url:    ajaxUrl,
                method: 'POST',
                data: {
                    action:     'biju_duplicate_products',
                    nonce:      nonce,
                    product_id: job.id,
                    copies:     job.copies
                },
                success: function(res) {
                    if (res.success) {
                        var c = res.data.copies.length;
                        var txt = '✔ "' + escHtml(res.data.original) + '" — ' + c + (c === 1 ? ' cópia criada' : ' cópias criadas') + ' (rascunho)';
                        \$('#biju-dup-log').prepend('<li class="ok">' + txt + '</li>');
                    } else {
                        \$('#biju-dup-log').prepend('<li class="err">Erro em produto #' + job.id + ': ' + escHtml(res.data) + '</li>');
                    }
                },
                error: function() {
                    \$('#biju-dup-log').prepend('<li class="err">Falha de rede no produto #' + job.id + '</li>');
                },
                complete: function() {
                    done++;
                    next();
                }
            });
        }
        next();
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
})(jQuery);
JS;
    }
}
