import fs from 'node:fs';
import path from 'node:path';
const here=import.meta.dirname,inventory=JSON.parse(fs.readFileSync(path.join(here,'inventory.json'),'utf8'));
const rows=inventory.aliases.map((r,i)=>({id:'name-'+String(i+1).padStart(2,'0'),split:'development',group:'canonical-name-'+r.shape,text:r.name+'を眺めた。',kind:'positive',shape:r.shape,source:'generated canonical-name smoke, not lexical novelty'}));
const authored=[
 ['庭で小鳥が歌った。','bird'],['魚を描いた。','fish'],['木の葉が揺れた。','leaf'],['結び目を見た。','knot'],['カメの標本を記録した。','turtle'],['なみなみの水面。','wave'],
 ['手帳にスパイダーの模様を描き足した。','spider'],['The sketch shows a kettle near the table.','teapot'],['海月の展示を観察した。','jellyfish'],['庭の草花を写生する。','flower'],
 ['A regular hexahedron with six equal squares as faces.','cube'],['A rectangular parallelepiped.','cuboid'],['A disk that spins on an axle and transmits force.','gear'],['A limbless scaly reptile with an elongated body.','snake'],
 ['A portable shelter against falling rain.','umbrella'],['A vessel with a handle for drinking a hot liquid.','cup'],['A closed smooth surface whose points are equidistant from its center.','condense'],['A hollow vessel for holding cut blossoms.','vase'],
 ['落ちる水をスケッチした。','droplet'],['枝を伸ばす景色を絵にする。','tree'],['お茶を注ぐ道具を机に置いた。','teapot'],['ねじれた輪を描き足した。','mobius'],['水面みたいな模様を記録した。','wave'],['ふわふわの風景を絵にした。','cloud'],
];
for(const [i,[text,shape]] of authored.entries())rows.push({id:'authored-'+String(i+1).padStart(2,'0'),split:'development',group:'manual-dev-'+(i+1),text,kind:'positive',shape,source:'this agent authored before independent evaluation'});
const holds=['会議の議事録を整理して提出した。','今日は文章を書く時間を確保した。','売上の表を見直す。','読みやすい見出しを考えた。','const tree = {value: 3};','The shell script returns a value.','二分木の関数を実装した。','クラゲではない形を考える。','Do not draw a bird.','形の変更は取り消して。','「花瓶」という文字を引用した。','He wrote "snake" in a quotation.','来月は予定を整理する。','費用は300円だった。','木曜日は授業を受ける。','言葉の順序を確認した。','葉っぱではなく文章を読みたい。','スプリングを見たが形は変えない。','A cloud server stores the files.','完成したコードを保存する。'];
for(const [i,text] of holds.entries())rows.push({id:'hold-'+String(i+1).padStart(2,'0'),split:'development',group:'manual-hold-'+(i+1),text,kind:'hold',shape:null,source:'this agent authored before independent evaluation'});
const ambiguous=['鳥と魚のどちらも描いた。','花と星が重なる。','カップと瓶を比較する。','とげとげのものを想像した。','角ばった模様が浮かぶ。','宇宙みたいな雰囲気。','羽ばたくものの模様。','ぐるぐるした風景。','A sculpture like freedom.','物語の勇気を表現する。'];
for(const [i,text] of ambiguous.entries())rows.push({id:'ambiguous-'+String(i+1).padStart(2,'0'),split:'development',group:'manual-ambiguous-'+(i+1),text,kind:'ambiguous',shape:null,source:'conservative local policy: hold; subjective artistic alternatives not ground truth'});
const pilots=['庭で小鳥が歌った。','魚を描いた。','木の葉が揺れた。','結び目を見た。','カメの標本を記録した。','なみなみの水面。','a long narrow reptile with no legs','a coiled narrow shape'];
fs.writeFileSync(path.join(here,'DEV.json'),JSON.stringify({schema:1,author:'implementation agent; development only, Human0',thresholdSelection:'Numeric thresholds fixed in first weight build before dev/pilot scores; no threshold search. This dev may diagnose implementation defects only before freeze.',rows},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(here,'PILOT-INPUTS.json'),JSON.stringify({schema:1,rows:pilots.map((text,i)=>({id:'pilot-'+(i+1),text})),purpose:'All first eight probes retained; weights.json R0 before profile feature-boundary correction.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({devRows:rows.length,positive:rows.filter(r=>r.kind==='positive').length,hold:holds.length,ambiguous:ambiguous.length,pilot:pilots.length}));
