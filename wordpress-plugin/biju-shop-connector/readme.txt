=== Biju Shop Connector ===
Contributors: bijushop
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later

Integra o frontend headless React do Biju Shop com o WooCommerce via REST API segura.

== Descrição ==

O Biju Shop Connector cria endpoints REST públicos e autenticados que permitem ao
frontend React acessar dados do WooCommerce sem expor credenciais de admin.

Recursos:
* Endpoints de produtos com filtros (categoria, busca, destaque)
* Endpoint de categorias
* Criação de pedidos real no WooCommerce
* Autenticação JWT leve (sem dependências externas)
* CORS configurável para o domínio do frontend
* Painel de configurações no WordPress Admin

== Instalação ==

1. Faça upload da pasta `biju-shop-connector` para `/wp-content/plugins/`
2. Ative o plugin em "Plugins" no painel do WordPress
3. Acesse Configurações → Biju Shop e defina a URL do seu frontend React
4. Copie `.env.example` para `.env` no projeto React e ajuste `VITE_API_URL`

== Endpoints ==

| Método | Endpoint                     | Auth     | Descrição                    |
|--------|------------------------------|----------|------------------------------|
| GET    | /biju/v1/products            | Público  | Listar produtos               |
| GET    | /biju/v1/products/{id}       | Público  | Detalhe do produto           |
| GET    | /biju/v1/categories          | Público  | Listar categorias             |
| POST   | /biju/v1/orders              | Público  | Criar pedido                  |
| GET    | /biju/v1/orders/{id}         | Token    | Status do pedido              |
| POST   | /biju/v1/auth/login          | Público  | Login (retorna JWT)           |
| POST   | /biju/v1/auth/register       | Público  | Registro (retorna JWT)        |
| GET    | /biju/v1/account             | Token    | Dados da conta               |
| GET    | /biju/v1/account/orders      | Token    | Pedidos do cliente           |

== Parâmetros de produtos ==

GET /biju/v1/products?page=1&per_page=20&category=colares&search=anel&orderby=price&order=ASC

== Changelog ==

= 1.0.0 =
* Versão inicial com produtos, pedidos e autenticação JWT.
