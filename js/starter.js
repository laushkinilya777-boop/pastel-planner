// Стартовый набор: фото с Unsplash (бесплатная лицензия Unsplash) и мотивационные фразы.
// Хозяйка сама отмечает, какие добавить. У каждой картинки постоянный id, поэтому дубликатов не будет.

const U = (photo) => `https://images.unsplash.com/${photo}?w=1080&q=80&fm=jpg&fit=crop`;
const P = (photo, group, page) => ({ key: photo, kind: 'link', category: group === 'cat' ? 'cats' : 'dogs', url: U(photo), page: `https://unsplash.com${page}` });

export const STARTER_GROUPS = [
  { id: 'white', name: 'Белые голубоглазые котики' },
  { id: 'ginger', name: 'Рыжие котики' },
  { id: 'calico', name: 'Трёхцветные котики' },
  { id: 'lab', name: 'Лабрадоры' },
  { id: 'chi', name: 'Чихуахуа' },
  { id: 'malti', name: 'Беленькие мультипу' },
  { id: 'dachs', name: 'Таксы' },
  { id: 'quotes', name: 'Мотивация' },
];

export const STARTER = [
  { ...P('photo-1692545219507-f37e87360f5f', 'cat', '/photos/a-white-cat-with-blue-eyes-laying-on-a-bed-UhHj4NheWxM'), group: 'white' },
  { ...P('photo-1728972226640-87bb9d5dafd2', 'cat', '/photos/a-white-cat-with-blue-eyes-hiding-in-the-grass-mcslKq5gJG0'), group: 'white' },
  { ...P('photo-1684216972242-67adc9a7e53d', 'cat', '/photos/a-white-cat-with-blue-eyes-sitting-on-a-bed-3kcW2G1xC9A'), group: 'white' },
  { ...P('photo-1604675223954-b1aabd668078', 'cat', '/photos/zlqZtlHTv3E'), group: 'ginger' },
  { ...P('photo-1629908579970-aaffeb2a3659', 'cat', '/photos/W6_PNq9EmN4'), group: 'ginger' },
  { ...P('photo-1768220794289-37de4bb51eeb', 'cat', '/s/photos/orange-tabby-cat'), group: 'ginger' },
  { ...P('photo-1503777119540-ce54b422baff', 'cat', '/photos/calico-cat-xadzcCQZ_Xc'), group: 'calico' },
  { ...P('photo-1617602819745-7780a53e3518', 'cat', '/photos/calico-cat-on-brown-wooden-table-SQv5Ry3E8KU'), group: 'calico' },
  { ...P('photo-1767319345518-5c574eac2cfb', 'cat', '/photos/a-calico-cat-rests-on-a-bed-of-autumn-leaves-_BO8z7mAGgc'), group: 'calico' },
  { ...P('photo-1537204696486-967f1b7198c8', 'dog', '/photos/adult-yellow-labrador-retriever-c7bUIRBqapA'), group: 'lab' },
  { ...P('photo-1629598624490-609d11c95b63', 'dog', '/photos/yellow-labrador-retriever-puppy-on-clear-glass-bowl-RO6GhNH14jg'), group: 'lab' },
  { ...P('photo-1629143392936-86ecc171c0ed', 'dog', '/photos/yellow-labrador-retriever-on-water-during-daytime-rR-fTUEu7hs'), group: 'lab' },
  { ...P('photo-1610041518868-f9284e7eecfe', 'dog', '/photos/brown-chihuahua-puppy-on-brown-textile-ASZX50HNskE'), group: 'chi' },
  { ...P('photo-1773504647229-b41e755a97cc', 'dog', '/photos/a-chihuahua-looks-up-at-a-butterfly-xS4b546vzdA'), group: 'chi' },
  { ...P('photo-1599709606362-2078844247fc', 'dog', '/photos/white-long-coat-small-dog-on-green-grass-field-during-daytime-zr0beNrnvgQ'), group: 'malti' },
  { ...P('photo-1696254643239-eeb065e3f35a', 'dog', '/photos/a-close-up-of-a-small-white-dog-sonGkKUhZ9s'), group: 'malti' },
  { ...P('photo-1690834595341-58e068a6215e', 'dog', '/photos/a-small-white-dog-standing-on-top-of-a-wooden-floor-FnmamssVfh8'), group: 'malti' },
  { ...P('photo-1746513230291-0aae1afea376', 'dog', '/photos/a-dachshund-puppy-is-sleeping-peacefully-on-a-green-chair-zgcB2zCL9JQ'), group: 'dachs' },
  { ...P('photo-1596116082596-7a0da930b9aa', 'dog', '/photos/brown-and-black-long-haired-dachshund-DLdDrb2d4F4'), group: 'dachs' },
  { ...P('photo-1605638868237-0660a05a135b', 'dog', '/photos/black-and-brown-short-coated-dog-on-white-textile-atTzhE48WXI'), group: 'dachs' },
  ...[
    'Маленькие шаги — тоже шаги',
    'Сегодня ты уже молодец',
    'Не идеально, но сделано',
    'Отдых — тоже часть плана',
    'Ты справишься, как справлялась всегда',
    'Одна задача за раз',
    'Будь к себе так же добра, как к котику',
    'Хороший день начинается с одной галочки',
    'Ты растёшь, даже когда этого не видно',
    'Сначала кофе, потом великие дела',
  ].map((text) => ({ key: `quote:${text}`, kind: 'quote', category: 'motivation', text, group: 'quotes' })),
];

// Постоянный UUID из ключа (FNV-1a, 4 прохода с разной «солью»).
export function starterId(key) {
  const hex = [0, 1, 2, 3].map((salt) => {
    let h = 0x811c9dc5 ^ salt;
    for (const ch of `starter:${salt}:${key}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function starterRow(item) {
  return item.kind === 'quote'
    ? { id: starterId(item.key), kind: 'quote', text: item.text, category: 'motivation' }
    : { id: starterId(item.key), kind: 'link', url: item.url, category: item.category };
}
