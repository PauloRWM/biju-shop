<?php
/**
 * Plugin Name: Biju Uploads Cache Headers
 * Description: Define Cache-Control de longa duração para imagens servidas de
 *              /wp-content/uploads/. O Lighthouse aponta "ciclos de vida de cache
 *              ineficientes" (~5 MB) porque as imagens de produto saem sem
 *              max-age longo. Como o WooCommerce gera nomes versionados por tamanho
 *              (ex: foto-324x405.jpg) e nunca reescreve o mesmo arquivo, é seguro
 *              cachear por 1 ano.
 *
 * INSTALAÇÃO: copiar para wp-content/mu-plugins/biju-uploads-cache.php
 *
 * OBS: o ideal é fazer isso no servidor (Nginx/Apache .htaccess do uploads),
 *      porque assim a imagem nem chega ao PHP. Este mu-plugin é o fallback para
 *      quando a imagem passa pelo WordPress (ex: hospedagem que roteia tudo pelo PHP).
 *      Veja também o bloco <FilesMatch> sugerido no .htaccess da raiz.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'send_headers', function () {
    $uri = $_SERVER['REQUEST_URI'] ?? '';

    // Só mexe em requisições de mídia dentro de uploads.
    if ( strpos( $uri, '/wp-content/uploads/' ) === false ) {
        return;
    }

    if ( ! preg_match( '#\.(jpe?g|png|gif|webp|avif|svg|ico)(\?|$)#i', $uri ) ) {
        return;
    }

    // 1 ano, imutável: o navegador reusa sem revalidar.
    header_remove( 'Pragma' );
    header( 'Cache-Control: public, max-age=31536000, immutable' );
} );
