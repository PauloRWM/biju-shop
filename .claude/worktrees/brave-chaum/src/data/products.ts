export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  category: string;
  images: string[];
  badge?: string;
  rating: number;
  reviews: number;
  material: string;
  colors: string[];
  inStock: boolean;
}

export const categories = [
  "Todos",
  "Colares",
  "Brincos",
  "Pulseiras",
  "Anéis",
  "Conjuntos",
];

export const products: Product[] = [
  {
    id: "1",
    name: "Colar Delicado Coração Dourado",
    price: 49.90,
    originalPrice: 79.90,
    description: "Colar delicado com pingente de coração banhado a ouro 18k. Perfeito para uso diário, trazendo elegância e sofisticação ao seu visual. Corrente ajustável com fecho de lagosta.",
    category: "Colares",
    images: [
      "https://picsum.photos/seed/colar1/600/600",
      "https://picsum.photos/seed/colar2/600/600",
    ],
    badge: "Mais Vendido",
    rating: 4.8,
    reviews: 124,
    material: "Banhado a ouro 18k",
    colors: ["Dourado", "Rose"],
    inStock: true,
  },
  {
    id: "2",
    name: "Brinco Argola Média Prata",
    price: 34.90,
    description: "Brincos de argola média em prata 925. Design clássico e atemporal que combina com qualquer ocasião. Fecho tipo clique para maior segurança.",
    category: "Brincos",
    images: [
      "https://picsum.photos/seed/brinco1/600/600",
    ],
    rating: 4.6,
    reviews: 89,
    material: "Prata 925",
    colors: ["Prata"],
    inStock: true,
  },
  {
    id: "3",
    name: "Pulseira Charm Estrelas",
    price: 59.90,
    originalPrice: 89.90,
    description: "Pulseira com charms de estrelas delicadas. Banhada a ouro rosé, ideal para empilhar com outras pulseiras. Fecho ajustável.",
    category: "Pulseiras",
    images: [
      "https://picsum.photos/seed/pulseira1/600/600",
    ],
    badge: "Promoção",
    rating: 4.9,
    reviews: 67,
    material: "Banhado a ouro rosé",
    colors: ["Rose", "Dourado"],
    inStock: true,
  },
  {
    id: "4",
    name: "Anel Solitário Zircônia",
    price: 39.90,
    description: "Anel solitário com zircônia brilhante central. Banhado a ouro 18k com acabamento polido. Disponível em vários tamanhos.",
    category: "Anéis",
    images: [
      "https://picsum.photos/seed/anel1/600/600",
    ],
    rating: 4.7,
    reviews: 156,
    material: "Banhado a ouro 18k",
    colors: ["Dourado"],
    inStock: true,
  },
  {
    id: "5",
    name: "Conjunto Colar e Brincos Pérola",
    price: 89.90,
    originalPrice: 129.90,
    description: "Conjunto elegante com colar e brincos de pérola sintética. Ideal para ocasiões especiais. Embalagem premium para presente.",
    category: "Conjuntos",
    images: [
      "https://picsum.photos/seed/conjunto1/600/600",
    ],
    badge: "Presente Ideal",
    rating: 4.9,
    reviews: 203,
    material: "Pérola sintética com banho de ródio",
    colors: ["Branco", "Rose"],
    inStock: true,
  },
  {
    id: "6",
    name: "Brinco Gota Cristal Azul",
    price: 44.90,
    description: "Brincos em formato de gota com cristal azul. Design sofisticado que realça qualquer produção. Base banhada a prata.",
    category: "Brincos",
    images: [
      "https://picsum.photos/seed/brinco2/600/600",
    ],
    rating: 4.5,
    reviews: 78,
    material: "Cristal com banho de prata",
    colors: ["Azul", "Prata"],
    inStock: true,
  },
  {
    id: "7",
    name: "Colar Choker Corrente Grossa",
    price: 54.90,
    description: "Choker de corrente grossa estilo chunky. Tendência atual que adiciona personalidade ao look. Banhada a ouro 18k.",
    category: "Colares",
    images: [
      "https://picsum.photos/seed/choker1/600/600",
    ],
    rating: 4.4,
    reviews: 45,
    material: "Banhado a ouro 18k",
    colors: ["Dourado"],
    inStock: false,
  },
  {
    id: "8",
    name: "Pulseira Riviera Zircônias",
    price: 69.90,
    originalPrice: 99.90,
    description: "Pulseira riviera cravejada com zircônias brilhantes. Peça statement que eleva qualquer produção. Fecho com trava de segurança.",
    category: "Pulseiras",
    images: [
      "https://picsum.photos/seed/riviera1/600/600",
    ],
    badge: "Novo",
    rating: 4.8,
    reviews: 34,
    material: "Banhado a ouro 18k com zircônias",
    colors: ["Dourado", "Prata"],
    inStock: true,
  },
];
