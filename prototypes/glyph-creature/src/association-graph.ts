/** Authored visual associations. These edges are artistic choices, not learned facts. */
export type VisualNode = { id: string; words: string[]; forms?: [string, number][]; links?: [string, number][] };
export const VISUAL_GRAPH: VisualNode[] = [
  { id: 'loop', words: ['輪っか','わっか','輪のよう','輪みたい','輪状','環状','くるりと閉じる','ひとつながり','loop'], links: [['twisted-loop',1],['circular',.95]] },
  { id: 'twisted-loop', words: ['ねじれた輪','ひねった輪','ねじれたわっか','ねじれた輪っか','裏も表もない','表も裏もない','終わりのない帯','twisted loop','endless ribbon'], forms: [['mobius',1]] },
  { id: 'circular', words: ['ぐるり','環っか','輪になった','輪になって','丸い輪','円みたい'], forms: [['ring',1]] },
  { id: 'spiral', words: ['ぐるぐる','くるくる','巻き巻き','渦巻き状','渦巻状','巻いていく','らせん状','螺旋状','spiraling'], forms: [['vortex',1],['helix',.96],['shell',.79]] },
  { id: 'round', words: ['まんまる','まん丸','ころころ','丸っこい','丸っぽい','球のよう','球みたい','丸いもの','round object'], forms: [['condense',1],['egg',.81]] },
  { id: 'angular', words: ['角ばった','角張った','角ばる','かくかく','カクカク','箱みたい','箱のよう','四角っぽい','四角いもの','boxy'], forms: [['cube',1],['cuboid',.94]] },
  { id: 'long', words: ['細長いもの','棒みたい','棒のよう','にょろにょろ','くねくね','うねうね','しなやかな'], forms: [['snake',1],['ribbon',.94],['helix',.76]] },
  { id: 'spiky', words: ['とげとげ','トゲトゲ','尖ったもの','ぎざぎざ','ギザギザ','鋭いもの','spiky','jagged'], forms: [['sun',1],['gear',.92],['star',.9],['diamond',.78]] },
  { id: 'soft', words: ['ふわふわ','ふわり','もくもく','ぷかぷか','綿のよう','綿みたい','fluffy'], forms: [['cloud',1],['jellyfish',.92]] },
  { id: 'water', words: ['ぽたぽた','ぽたり','したたる','滴る','しずくのよう','落ちる水','涙のよう','teardrop'], forms: [['droplet',1]] },
  { id: 'bloom', words: ['ひらひら','ひらくもの','咲いて','咲いた','咲くもの','花が咲く','blooming'], forms: [['flower',1],['lotus',.92],['rose',.9],['butterfly',.78]] },
  { id: 'wing', words: ['羽ばたく','羽ばたいて','はばたく','はばたいて','翼のある','羽のある','flapping'], forms: [['bird',1],['butterfly',.96]] },
  { id: 'container', words: ['うつわ','器のよう','器みたい','入れもの','入れ物','容器','花を生ける','花をいける','container'], forms: [['vase',1],['cup',.9],['bottle',.84]] },
  { id: 'drinking', words: ['飲み物を入れる','飲物を入れる','お茶を注ぐ','お茶をいれる','注ぎ口のある'], forms: [['teapot',1],['cup',.82]] },
  { id: 'branch', words: ['枝分かれ','枝分れ','枝を伸ばす','枝が伸びる','branching'], forms: [['tree',1],['snowflake',.84]] },
  { id: 'night-sky', words: ['夜空の光','夜空に光','夜空に輝く','星空','宇宙のよう','宇宙みたい','cosmic'], forms: [['star',1],['saturn',.96],['moon',.92],['orbit',.82]] },
  { id: 'knot', words: ['結び目','むすびめ','結んだひも','絡まったひも','絡み合う','組みひも','knotwork'], forms: [['knot',1],['mobius',.81]] },
  { id: 'wavy', words: ['なみなみ','さざなみ','波のよう','波みたい','水面のよう','水面みたい','波形','undulating'], forms: [['wave',1],['ribbon',.9]] },
  { id: 'hanging', words: ['ぶらさがる','ぶら下がる','吊り下げた','吊るした','ぶらぶら'], forms: [['lantern',1],['bell',.9]] },
  { id: 'swimming', words: ['泳ぐもの','泳いでいる','泳いでる','水の中の生き物','swimming'], forms: [['fish',1],['jellyfish',.89],['turtle',.86]] },
];
