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
  { id: 'happy', name: 'Весёлые — за выполненное' },
  { id: 'sad', name: 'Грустные — когда задачи ждут' },
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
  { ...P('photo-1537204696486-967f1b7198c8', 'dog', '/photos/adult-yellow-labrador-retriever-c7bUIRBqapA'), mood: 'happy', group: 'lab' },
  { ...P('photo-1629598624490-609d11c95b63', 'dog', '/photos/yellow-labrador-retriever-puppy-on-clear-glass-bowl-RO6GhNH14jg'), mood: 'happy', group: 'lab' },
  { ...P('photo-1629143392936-86ecc171c0ed', 'dog', '/photos/yellow-labrador-retriever-on-water-during-daytime-rR-fTUEu7hs'), mood: 'happy', group: 'lab' },
  { ...P('photo-1610041518868-f9284e7eecfe', 'dog', '/photos/brown-chihuahua-puppy-on-brown-textile-ASZX50HNskE'), group: 'chi' },
  { ...P('photo-1773504647229-b41e755a97cc', 'dog', '/photos/a-chihuahua-looks-up-at-a-butterfly-xS4b546vzdA'), mood: 'happy', group: 'chi' },
  { ...P('photo-1599709606362-2078844247fc', 'dog', '/photos/white-long-coat-small-dog-on-green-grass-field-during-daytime-zr0beNrnvgQ'), group: 'malti' },
  { ...P('photo-1696254643239-eeb065e3f35a', 'dog', '/photos/a-close-up-of-a-small-white-dog-sonGkKUhZ9s'), group: 'malti' },
  { ...P('photo-1690834595341-58e068a6215e', 'dog', '/photos/a-small-white-dog-standing-on-top-of-a-wooden-floor-FnmamssVfh8'), group: 'malti' },
  { ...P('photo-1746513230291-0aae1afea376', 'dog', '/photos/a-dachshund-puppy-is-sleeping-peacefully-on-a-green-chair-zgcB2zCL9JQ'), group: 'dachs' },
  { ...P('photo-1596116082596-7a0da930b9aa', 'dog', '/photos/brown-and-black-long-haired-dachshund-DLdDrb2d4F4'), group: 'dachs' },
  { ...P('photo-1605638868237-0660a05a135b', 'dog', '/photos/black-and-brown-short-coated-dog-on-white-textile-atTzhE48WXI'), group: 'dachs' },
  { ...P('photo-1543466835-00a7907e9de1', 'dog', '/photos/dogs-face-2l0CWTpcChI'), group: 'happy', mood: 'happy' },
  { ...P('photo-1656839631462-1adf96d4320f', 'dog', '/photos/a-dog-with-its-mouth-open-IV-EwnX6yEw'), group: 'happy', mood: 'happy' },
  { ...P('photo-1587300003388-59208cc962cb', 'dog', '/photos/white-and-brown-long-coat-large-dog-U3aF7hgUSrk'), group: 'happy', mood: 'happy' },
  { ...P('photo-1453227588063-bb302b62f50b', 'dog', '/photos/pug-covered-with-blanket-on-bedspread-2Ts5HnA67k8'), group: 'sad', mood: 'sad' },
  { ...P('photo-1617142108319-66c7ab45c711', 'dog', '/photos/golden-retriever-lying-on-floor-8LZCvlyQ8hY'), group: 'sad', mood: 'sad' },
  { ...P('photo-1767978278701-220ba20b2777', 'dog', '/photos/a-tan-dog-rests-its-head-on-the-floor-NgaekLvbMkk'), group: 'sad', mood: 'sad' },
  { ...P('photo-1529927066849-79b791a69825', 'dog', '/photos/fawn-pug-puppy-laying-on-ground-TPZNooS1Meg'), group: 'sad', mood: 'sad' },
  { ...P('photo-1561948955-570b270e7c36', 'cat', '/photos/white-kitten-Tn8DLxwuDMA'), group: 'sad', mood: 'sad' },
  { ...P('photo-1767984538997-fafa0f3755f1', 'cat', '/photos/a-sad-orange-and-white-cat-sitting-indoors-5S9nzDxRWKc'), group: 'sad', mood: 'sad' },
  { ...P('photo-1706376935638-54b7efac568c', 'cat', '/photos/a-cat-sitting-on-a-window-sill-in-the-dark-RCeKO3hpQJU'), group: 'sad', mood: 'sad' },
  { ...P('photo-1498579687545-d5a4fffb0a9e', 'cat', '/photos/white-and-gray-tabby-kitten-on-brown-wooden-crate-EcBBbfNpeYA'), group: 'sad', mood: 'sad' },
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
  ].map((text) => ({ key: `quote:${text}`, kind: 'quote', category: 'motivation', text, group: 'quotes', mood: null })),
  ...[
    ['Ура! День закрыт на все сто', 'happy'],
    ['Ты сегодня просто огонь', 'happy'],
    ['Ничего, завтра получится', 'sad'],
    ['Задачи подождут, а ты отдохни', 'sad'],
    ['Не всё сразу — и это нормально', 'sad'],
  ].map(([text, mood]) => ({ key: `quote:${text}`, kind: 'quote', category: 'motivation', text, group: 'quotes', mood })),
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
    ? { id: starterId(item.key), kind: 'quote', text: item.text, category: 'motivation', mood: item.mood || null }
    : { id: starterId(item.key), kind: 'link', url: item.url, category: item.category, mood: item.mood || null };
}
