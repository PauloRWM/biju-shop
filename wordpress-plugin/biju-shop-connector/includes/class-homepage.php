<?php
defined( 'ABSPATH' ) || exit;

/**
 * Configuração da página inicial e menu do header.
 * Endpoint: GET /biju/v1/homepage
 * Admin:    Configurações → Biju Shop → Página Inicial
 */
class Biju_Homepage {

    // -------------------------------------------------------------------------
    // REST endpoint
    // -------------------------------------------------------------------------

    public static function get_config( WP_REST_Request $request ): WP_REST_Response {
        // A homepage muda raramente (config de admin + categorias). Cacheia o
        // payload inteiro; antes recomputava menu, termos e uma query de
        // popularidade por seção a cada request.
        $payload = Biju_Cache::remember( 'homepage', 15 * MINUTE_IN_SECONDS, function () {
            $menu     = self::get_menu_items();
            $sections = get_option( 'biju_homepage_sections', self::default_sections() );

            $enriched = [];
            foreach ( $sections as $s ) {
                $term = get_term_by( 'slug', $s['slug'], 'product_cat' );
                if ( ! $term instanceof WP_Term ) continue;

                // Imagem: tenta thumbnail da categoria, senão pega do produto mais vendido.
                // IMPORTANTE: usa o tamanho 'woocommerce_thumbnail' (~300px) e NÃO
                // wp_get_attachment_url() — esta última devolvia a imagem ORIGINAL
                // (768x1024+, ~950 KB), pesando o payload e o card de categoria que
                // é exibido a apenas ~120px.
                $thumb_id  = get_term_meta( $term->term_id, 'thumbnail_id', true );
                $thumb_url = null;
                if ( $thumb_id ) {
                    $src = wp_get_attachment_image_src( (int) $thumb_id, 'woocommerce_thumbnail' );
                    $thumb_url = $src ? $src[0] : null;
                }

                if ( ! $thumb_url ) {
                    $top = wc_get_products( [
                        'status'   => 'publish',
                        'limit'    => 1,
                        'orderby'  => 'popularity',
                        'order'    => 'DESC',
                        'category' => [ $term->slug ],
                    ] );
                    if ( ! empty( $top ) ) {
                        $img_id = $top[0]->get_image_id();
                        if ( $img_id ) {
                            $src = wp_get_attachment_image_src( (int) $img_id, 'woocommerce_thumbnail' );
                            $thumb_url = $src ? $src[0] : null;
                        }
                    }
                }

                $enriched[] = [
                    'name'  => $term->name,
                    'slug'  => $term->slug,
                    'count' => (int) $term->count,
                    'image' => $thumb_url,
                ];
            }

            return [
                'menu'     => $menu,
                'sections' => $enriched,
                'banners'  => self::get_banners(),
            ];
        } );

        $response = new WP_REST_Response( $payload, 200 );
        $response->header( 'Cache-Control', 'public, max-age=60, s-maxage=60' );
        return $response;
    }

    // -------------------------------------------------------------------------
    // Menu helper — lê itens do menu WordPress selecionado
    // -------------------------------------------------------------------------

    private static function get_menu_items(): array {
        $menu_id = (int) get_option( 'biju_nav_menu_id', 0 );
        if ( ! $menu_id ) return self::default_menu();

        $items = wp_get_nav_menu_items( $menu_id );
        if ( ! is_array( $items ) ) return self::default_menu();

        $result = [];
        foreach ( $items as $item ) {
            // Só itens de nível raiz
            if ( $item->menu_item_parent != 0 ) continue;

            $slug = null;
            if ( $item->object === 'product_cat' ) {
                $term = get_term( $item->object_id, 'product_cat' );
                $slug = $term instanceof WP_Term ? $term->slug : null;
            }

            $result[] = [
                'label' => $item->title,
                'slug'  => $slug,
                'url'   => $slug ? null : $item->url,
            ];
        }

        return $result ?: self::default_menu();
    }

    // -------------------------------------------------------------------------
    // Admin page
    // -------------------------------------------------------------------------

    public static function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;

        // Habilita o seletor da Biblioteca de Mídia (wp.media) nesta página.
        wp_enqueue_media();

        $saved = false;
        if ( isset( $_POST['biju_save_homepage'] ) && check_admin_referer( 'biju_homepage' ) ) {
            update_option( 'biju_nav_menu_id', absint( $_POST['biju_nav_menu_id'] ?? 0 ) );

            $sec_slugs = array_filter( array_map( 'sanitize_text_field', (array) ( $_POST['section_slug'] ?? [] ) ) );
            update_option( 'biju_homepage_sections', array_values( array_map( fn( $s ) => [ 'slug' => $s ], $sec_slugs ) ) );

            // Banners — arrays paralelos (uma entrada por linha, alinhadas por índice).
            $b_urls  = (array) ( $_POST['banner_image_url'] ?? [] );
            $b_ids   = (array) ( $_POST['banner_image_id'] ?? [] );
            $b_links = (array) ( $_POST['banner_link'] ?? [] );
            $b_alts  = (array) ( $_POST['banner_alt'] ?? [] );
            $banners = [];
            foreach ( $b_urls as $i => $url ) {
                $url = esc_url_raw( trim( (string) $url ) );
                if ( ! $url ) continue; // linha sem imagem: ignora
                $link = trim( (string) ( $b_links[ $i ] ?? '' ) );
                if ( $link !== '' ) {
                    // Aceita URL http(s) OU path relativo (/shop?cat=X); descarta o resto.
                    if ( preg_match( '#^https?://#i', $link ) ) {
                        $link = esc_url_raw( $link );
                    } elseif ( $link[0] === '/' ) {
                        $link = sanitize_text_field( $link );
                    } else {
                        $link = '';
                    }
                }
                $banners[] = [
                    'image_id' => absint( $b_ids[ $i ] ?? 0 ),
                    'image'    => $url,
                    'link'     => $link,
                    'alt'      => sanitize_text_field( (string) ( $b_alts[ $i ] ?? '' ) ),
                ];
            }
            update_option( 'biju_home_banners', $banners );

            // Invalida o cache da /homepage imediatamente. O bump_version sozinho
            // NÃO é confiável com o Redis Object Cache ativo (alguns requests ainda
            // leem a versão antiga → servem banners obsoletos). Como salvar a home
            // é uma ação de admin RARA, um flush do object cache aqui garante que a
            // mudança apareça na hora, sem impacto perceptível de performance.
            if ( class_exists( 'Biju_Cache' ) ) {
                Biju_Cache::bump_version();
            }
            if ( function_exists( 'wp_cache_flush' ) ) {
                wp_cache_flush();
            }

            $saved = true;
        }

        $nav_menu_id = (int) get_option( 'biju_nav_menu_id', 0 );
        $nav_menus   = wp_get_nav_menus();
        $sections    = get_option( 'biju_homepage_sections', self::default_sections() );
        $cats        = get_terms( [ 'taxonomy' => 'product_cat', 'hide_empty' => false, 'orderby' => 'name' ] );
        if ( is_wp_error( $cats ) ) $cats = [];
        ?>
        <div class="wrap">
            <h1>Biju Shop — Página Inicial</h1>

            <?php if ( $saved ): ?>
                <div class="updated notice is-dismissible"><p>Configurações salvas.</p></div>
            <?php endif; ?>

            <form method="post">
                <?php wp_nonce_field( 'biju_homepage' ); ?>

                <!-- ── MENU ────────────────────────────────────────────── -->
                <h2 style="margin-top:24px">Menu Principal (Header)</h2>
                <p class="description">
                    Selecione um menu criado em <a href="<?php echo admin_url('nav-menus.php'); ?>">Aparência → Menus</a>.<br>
                    Endpoint: <code><?php echo esc_html( rest_url( 'biju/v1/homepage' ) ); ?></code>
                </p>

                <table class="form-table" style="max-width:500px">
                    <tr>
                        <th><label for="biju_nav_menu_id">Menu</label></th>
                        <td>
                            <select name="biju_nav_menu_id" id="biju_nav_menu_id">
                                <option value="0">— Nenhum (usar padrão) —</option>
                                <?php foreach ( $nav_menus as $m ) : ?>
                                    <option value="<?php echo esc_attr( $m->term_id ); ?>" <?php selected( $m->term_id, $nav_menu_id ); ?>>
                                        <?php echo esc_html( $m->name ); ?> (<?php echo $m->count; ?> itens)
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <?php if ( empty( $nav_menus ) ) : ?>
                                <p class="description" style="color:#d63638">Nenhum menu encontrado. <a href="<?php echo admin_url('nav-menus.php'); ?>">Criar menu</a>.</p>
                            <?php endif; ?>
                        </td>
                    </tr>
                </table>

                <hr style="margin:32px 0">

                <!-- ── SEÇÕES ──────────────────────────────────────────── -->
                <h2>Seções da Página Inicial</h2>
                <p class="description">Cada seção exibe produtos de uma categoria (na ordem definida aqui).</p>

                <table class="widefat striped" id="biju-sections-table" style="max-width:500px;margin-top:12px">
                    <thead>
                        <tr>
                            <th>Categoria</th>
                            <th style="width:80px"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $sections as $sec ) : ?>
                        <tr>
                            <td><?php self::cat_select( 'section_slug[]', $sec['slug'], $cats ); ?></td>
                            <td><button type="button" class="button biju-remove">✕ Remover</button></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button" id="biju-add-section">+ Adicionar seção</button></p>

                <hr style="margin:32px 0">

                <!-- ── BANNERS ─────────────────────────────────────────── -->
                <h2>Banners da Página Inicial</h2>
                <p class="description">
                    Imagens do carrossel no topo da home. Recomendado: <strong>~1920×1080px</strong> (paisagem), .jpg/.webp.<br>
                    O <strong>link</strong> é opcional — pode ser um caminho do site (ex.: <code>/shop?cat=Colares</code>) ou uma URL completa. Sem banner cadastrado, a home usa os banners padrão.
                </p>

                <?php
                $banners_cfg = get_option( 'biju_home_banners', [] );
                if ( ! is_array( $banners_cfg ) ) $banners_cfg = [];
                ?>
                <table class="widefat striped" id="biju-banners-table" style="max-width:900px;margin-top:12px">
                    <thead>
                        <tr>
                            <th style="width:230px">Imagem</th>
                            <th>Link (opcional)</th>
                            <th style="width:180px">Texto alternativo</th>
                            <th style="width:90px"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $banners_cfg as $b ) :
                            $img = esc_url( $b['image'] ?? '' ); ?>
                        <tr>
                            <td>
                                <div class="biju-banner-preview" style="margin-bottom:6px">
                                    <?php if ( $img ) : ?><img src="<?php echo $img; ?>" style="max-width:200px;height:auto;display:block;border:1px solid #ddd;border-radius:4px"><?php endif; ?>
                                </div>
                                <input type="hidden" name="banner_image_id[]" value="<?php echo absint( $b['image_id'] ?? 0 ); ?>">
                                <input type="hidden" name="banner_image_url[]" value="<?php echo esc_attr( $b['image'] ?? '' ); ?>">
                                <button type="button" class="button biju-pick-image"><?php echo $img ? 'Trocar imagem' : 'Selecionar imagem'; ?></button>
                            </td>
                            <td><input type="text" name="banner_link[]" value="<?php echo esc_attr( $b['link'] ?? '' ); ?>" placeholder="/shop?cat=Colares" style="width:100%"></td>
                            <td><input type="text" name="banner_alt[]" value="<?php echo esc_attr( $b['alt'] ?? '' ); ?>" placeholder="descrição" style="width:100%"></td>
                            <td><button type="button" class="button biju-remove-banner">✕ Remover</button></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button" id="biju-add-banner">+ Adicionar banner</button></p>

                <?php submit_button( 'Salvar', 'primary', 'biju_save_homepage' ); ?>
            </form>
        </div>

        <script>
        var bijuCats = <?php echo wp_json_encode( array_values( array_map( fn( $c ) => [ 'slug' => $c->slug, 'name' => $c->name ], $cats ) ) ); ?>;

        function catOptions( sel ) {
            return bijuCats.map( c => `<option value="${c.slug}"${c.slug===sel?' selected':''}>${c.name}</option>` ).join('');
        }

        document.getElementById('biju-add-section').addEventListener('click', () => {
            document.querySelector('#biju-sections-table tbody').insertAdjacentHTML('beforeend',
                `<tr><td><select name="section_slug[]">${catOptions('')}</select></td><td><button type="button" class="button biju-remove">✕ Remover</button></td></tr>`
            );
        });

        document.addEventListener('click', e => {
            if ( e.target.classList.contains('biju-remove') ) e.target.closest('tr').remove();
        });

        // ── Banners ──────────────────────────────────────────────────────
        function bijuBannerRow() {
            return `<tr>
                <td>
                    <div class="biju-banner-preview" style="margin-bottom:6px"></div>
                    <input type="hidden" name="banner_image_id[]" value="">
                    <input type="hidden" name="banner_image_url[]" value="">
                    <button type="button" class="button biju-pick-image">Selecionar imagem</button>
                </td>
                <td><input type="text" name="banner_link[]" value="" placeholder="/shop?cat=Colares" style="width:100%"></td>
                <td><input type="text" name="banner_alt[]" value="" placeholder="descrição" style="width:100%"></td>
                <td><button type="button" class="button biju-remove-banner">✕ Remover</button></td>
            </tr>`;
        }

        var addBanner = document.getElementById('biju-add-banner');
        if ( addBanner ) addBanner.addEventListener('click', () => {
            document.querySelector('#biju-banners-table tbody').insertAdjacentHTML('beforeend', bijuBannerRow());
        });

        document.addEventListener('click', e => {
            if ( e.target.classList.contains('biju-remove-banner') ) { e.target.closest('tr').remove(); return; }
            if ( e.target.classList.contains('biju-pick-image') ) {
                e.preventDefault();
                var btn  = e.target;
                var cell = btn.closest('td');
                var frame = wp.media({ title: 'Selecionar banner', button: { text: 'Usar esta imagem' }, library: { type: 'image' }, multiple: false });
                frame.on('select', function () {
                    var att = frame.state().get('selection').first().toJSON();
                    // Prefere um tamanho grande, mas cai pro full se não houver.
                    var url = (att.sizes && att.sizes.large) ? att.sizes.large.url : att.url;
                    cell.querySelector('input[name="banner_image_id[]"]').value  = att.id;
                    cell.querySelector('input[name="banner_image_url[]"]').value = url;
                    cell.querySelector('.biju-banner-preview').innerHTML =
                        '<img src="' + url + '" style="max-width:200px;height:auto;display:block;border:1px solid #ddd;border-radius:4px">';
                    btn.textContent = 'Trocar imagem';
                });
                frame.open();
            }
        });
        </script>
        <?php
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Banners do carrossel da home, configurados no admin (option biju_home_banners).
     * Retorna [{ image, link, alt }] só com os que têm imagem. Vazio → o front usa
     * os banners padrão embutidos (nunca deixa a home sem banner).
     */
    private static function get_banners(): array {
        $raw = get_option( 'biju_home_banners', [] );
        if ( ! is_array( $raw ) ) return [];
        $out = [];
        foreach ( $raw as $b ) {
            $img = isset( $b['image'] ) ? esc_url_raw( (string) $b['image'] ) : '';
            if ( ! $img ) continue;
            $out[] = [
                'image' => $img,
                'link'  => isset( $b['link'] ) ? (string) $b['link'] : '',
                'alt'   => isset( $b['alt'] ) ? (string) $b['alt'] : '',
            ];
        }
        return $out;
    }

    private static function cat_select( string $name, string $selected, array $cats ): void {
        echo '<select name="' . esc_attr( $name ) . '">';
        foreach ( $cats as $cat ) {
            printf(
                '<option value="%s"%s>%s</option>',
                esc_attr( $cat->slug ),
                selected( $cat->slug, $selected, false ),
                esc_html( $cat->name )
            );
        }
        echo '</select>';
    }

    private static function default_menu(): array {
        return [
            [ 'label' => 'Colares',   'slug' => 'colares' ],
            [ 'label' => 'Brincos',   'slug' => 'brincos' ],
            [ 'label' => 'Pulseiras', 'slug' => 'pulseiras' ],
            [ 'label' => 'Anéis',     'slug' => 'aneis' ],
            [ 'label' => 'Conjuntos', 'slug' => 'conjuntos' ],
        ];
    }

    private static function default_sections(): array {
        return [
            [ 'slug' => 'colares' ],
            [ 'slug' => 'brincos' ],
            [ 'slug' => 'pulseiras' ],
            [ 'slug' => 'aneis' ],
            [ 'slug' => 'conjuntos' ],
        ];
    }
}
