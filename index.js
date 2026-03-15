require("dotenv").config();
const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
SlashCommandBuilder,
REST,
Routes
} = require("discord.js");
const fs = require("fs");

/* ================= CONFIG ================= */

const OWNER_ID = process.env.OWNER_ID;

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

/* ================= DATA ================= */

const DATA_FILE="/data/data.json";

if(!fs.existsSync("/data")) fs.mkdirSync("/data");

let data=fs.existsSync(DATA_FILE)
?JSON.parse(fs.readFileSync(DATA_FILE))
:{};

function saveData(){
fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2));
}

function getUser(id){
if(!data[id]) data[id]={points:0,keywordCooldowns:{}};
if(!data[id].keywordCooldowns) data[id].keywordCooldowns={};
return data[id];
}

/* ================= ERROR HANDLER ================= */

process.on("unhandledRejection",error=>{
console.error("UNHANDLED:",error);
});

/* ================= HISTORY ================= */

async function logPoint(guild,userId,amount,reason){

const channel=guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID);
if(!channel) return;

const embed=new EmbedBuilder()
.setTitle("📜 Update Poin Ramadhan Fest")
.setDescription(`👤 <@${userId}>\n➕ +${amount} poin\n📌 ${reason}`)
.setColor("Gold")
.setTimestamp();

channel.send({embeds:[embed]});

}

/* ================= GAP BALANCE ================= */

function applyGapBalance(userId, baseReward){

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

if(!data[userId]) return baseReward

const rankIndex = sorted.findIndex(e=>e[0]===userId)

const topPoints = sorted[0][1].points
const userPoints = data[userId].points

const gap = topPoints - userPoints

let multiplier = 1

/* ===== RANK BALANCE ===== */

if(rankIndex === 0) multiplier *= 1
else if(rankIndex === 1) multiplier *= 1.1
else if(rankIndex === 2) multiplier *= 1.6
else if(rankIndex <= 5) multiplier *= 1.7
else multiplier *= 3

/* ===== GAP BALANCE (rank 2 kebawah) ===== */

if(rankIndex !== 0){

if(gap < 300) multiplier *= 1
else if(gap < 500) multiplier *= 1.1
else if(gap < 1000) multiplier *= 1.5
else if(gap < 2000) multiplier *= 1.6
else if(gap < 4000) multiplier *= 1.7
else multiplier *= 2

}


/* ===== FINAL REWARD ===== */

let reward = Math.floor(baseReward * multiplier)

return reward

}

/* ===== shuffle ===== */
function shuffle(array){
for(let i=array.length-1;i>0;i--){
const j=Math.floor(Math.random()*(i+1));
[array[i],array[j]]=[array[j],array[i]];
}
return array;
}

/* ================= LEADERBOARD ================= */

let leaderboardMessage=null;

async function updateLeaderboard(guild){

const channel=guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID);
if(!channel) return;

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)
.slice(0,10);

if(!sorted.length) return;

const first=sorted[0];
const second=sorted[1];

let desc="";

desc+=`🥇 **CALON JUARA #1**\n<@${first[0]}>\n📊 **${first[1].points} poin**\n`;

if(second){

const gap=first[1].points-second[1].points;

desc+=`📈 Unggul ${gap} poin\n\n`;
desc+=`🥈 **CALON JUARA #2**\n<@${second[0]}>\n📊 **${second[1].points} poin**\n`;
desc+=`📉 Tertinggal ${gap} poin\n\n`;

}

desc+="━━━━━━━━━━━━━━━━━━\n";

sorted.slice(2).forEach((entry,index)=>{
desc+=`**${index+3}.** <@${entry[0]}> — ${entry[1].points} poin\n`;
});

const embed=new EmbedBuilder()
.setTitle("🏆 RAMADHAN FEST — LIVE RANKING")
.setDescription(desc)
.setColor("Gold")
.setTimestamp();

const firstUser=await guild.members.fetch(first[0]).catch(()=>null);

if(firstUser){
embed.setThumbnail(firstUser.user.displayAvatarURL({dynamic:true}));
}

if(!leaderboardMessage)
leaderboardMessage=await channel.send({embeds:[embed]});
else
await leaderboardMessage.edit({embeds:[embed]});

}

/* ================= KEYWORD FARM ================= */

const keywordCooldown={
sahur:30*60*1000,
buka:30*60*1000,
tarawih:45*60*1000,
tadarus:50*60*1000,
sedekah:60*60*1000
};

client.on("messageCreate", async message => {

if(isEventPaused()) return

if(message.author.bot) return
if(message.channel.id !== process.env.KEYWORD_CHANNEL_ID) return

const content = message.content.toLowerCase().trim()
if(!keywordCooldown[content]) return

const user = getUser(message.author.id)
const now = Date.now()

if(now < (user.keywordCooldowns[content] || 0)){

const remain = Math.ceil((user.keywordCooldowns[content] - now) / 60000)

return message.reply(`⏳ Tunggu ${remain} menit lagi.`)

}

/* ===== BASE REWARD ===== */

let reward=Math.floor(Math.random()*40)+90

reward = applyGapBalance(message.author.id,reward)

if(Math.random()<0.02){
reward+=500
message.channel.send(`🎉 JACKPOT +500 poin`)
}

/* ===== SAVE ===== */

user.points += reward
user.keywordCooldowns[content] = now + keywordCooldown[content]

saveData()

await logPoint(
message.guild,
message.author.id,
reward,
"Farm"
)

/* ===== RANK ===== */

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

const rank = sorted.findIndex(e=>e[0]===message.author.id) + 1

const topPoints = sorted[0][1].points
const gap = topPoints - user.points

let gapText=""

if(rank===1){
gapText="👑 Kamu sedang memimpin leaderboard!"
}else{
gapText=`📉 ${gap} poin lagi untuk mengejar rank #1`
}

/* ===== EMBED ===== */

const embed=new EmbedBuilder()
.setColor("Gold")
.setDescription(
`✨ **+${reward} poin**

🏆 **Total: ${user.points} poin**
📊 **Rank: #${rank}**

${gapText}`
)
.setFooter({
text:message.author.username,
iconURL:message.author.displayAvatarURL({dynamic:true})
})

message.channel.send({embeds:[embed]})

await updateLeaderboard(message.guild)

})

/* ================= QUIZ ================= */

let activeQuiz=null;
const questions=[
 
{ question:"Dalam sebuah rapat, ide Anda ditolak mentah-mentah oleh atasan karena dianggap tidak relevan. Sikap Anda adalah...", correct:"Menerima argumen atasan dan mencoba memperbaiki ide tersebut agar lebih relevan", options:["Kecewa dan memilih diam sepanjang sisa rapat","Menerima argumen atasan dan mencoba memperbaiki ide tersebut agar lebih relevan","Tetap bersikukuh bahwa ide Anda adalah yang terbaik","Langsung keluar dari ruangan karena merasa tidak dihargai"] },

{ question:"Seorang rekan kerja menitipkan pekerjaannya kepada Anda karena ia ingin pergi berbelanja. Anda sendiri sedang sibuk. Apa yang Anda lakukan?", correct:"Menolaknya dengan sopan karena Anda harus menyelesaikan tanggung jawab sendiri", options:["Menerimanya agar dianggap teman yang baik","Menolaknya dengan sopan karena Anda harus menyelesaikan tanggung jawab sendiri","Melaporkannya langsung ke atasan agar ia ditegur","Membantunya setelah jam kerja selesai dengan imbalan"] },

{ question:"Semua mamalia menyusui anaknya. Semua lumba-lumba adalah mamalia. Kesimpulan yang tepat adalah...", correct:"Semua lumba-lumba menyusui anaknya", options:["Sebagian lumba-lumba menyusui anaknya","Semua lumba-lumba menyusui anaknya","Lumba-lumba bukan merupakan mamalia","Hanya lumba-lumba yang menyusui anaknya"] },

{ question:"Jika 'MATA' adalah '26-1-20-1', maka 'BUKU' adalah...", correct:"2-21-11-21", options:["2-15-11-21","2-21-11-15","2-21-11-21","3-21-11-21"] },

{ question:"Lembaga yang berwenang memutus pembubaran partai politik menurut UUD 1945 adalah...", correct:"Mahkamah Konstitusi", options:["Mahkamah Agung","Komisi Yudisial","DPR","Mahkamah Konstitusi"] },

{ question:"Pancasila sebagai 'Lembaga Tertinggi Negara' merupakan fungsi Pancasila sebagai...", correct:"Sumber dari segala sumber hukum", options:["Dasar Negara","Pandangan Hidup","Sumber dari segala sumber hukum","Kepribadian Bangsa"] },

{ question:"Anda ditugaskan ke daerah terpencil yang tidak memiliki akses internet. Sikap Anda...", correct:"Menerima tugas tersebut sebagai tantangan untuk beradaptasi dan mengabdi", options:["Meminta pindah tugas ke kota besar","Menerima tugas tersebut sebagai tantangan untuk beradaptasi dan mengabdi","Protes karena internet adalah kebutuhan pokok kerja","Menjalankan tugas dengan setengah hati"] },

{ question:"Hasil dari 12,5% dari 512 adalah...", correct:"64", options:["48","64","72","86"] },

{ question:"Deret angka: 2, 4, 8, 14, 22, ... Angka selanjutnya adalah...", correct:"32", options:["30","32","34","36"] },

{ question:"Tokoh yang memimpin perlawanan dalam Pertempuran 10 November di Surabaya adalah...", correct:"Bung Tomo", options:["Jenderal Sudirman","Bung Tomo","Moh. Hatta","Ir. Soekarno"] },

{ question:"Sikap yang menunjukkan nilai sila kedua Pancasila dalam kehidupan sehari-hari adalah...", correct:"Menggalang dana untuk korban bencana alam tanpa membeda-bedakan", options:["Menghargai pendapat orang lain saat rapat","Menggalang dana untuk korban bencana alam tanpa membeda-bedakan","Melakukan musyawarah mufakat","Beribadah tepat waktu"] },

{ question:"Suatu pekerjaan dapat diselesaikan oleh 10 orang dalam 12 hari. Jika ingin selesai dalam 8 hari, berapa orang tambahan yang diperlukan?", correct:"5 orang", options:["3 orang","5 orang","15 orang","2 orang"] },

{ question:"Andi lebih tua dari Budi. Cici lebih muda dari Budi. Dedi lebih tua dari Cici tapi lebih muda dari Budi. Siapa yang paling muda?", correct:"Cici", options:["Andi","Budi","Cici","Dedi"] },

{ question:"BPUPKI dibentuk pada tanggal...", correct:"1 Maret 1945", options:["1 Maret 1945","29 Mei 1945","1 Juni 1945","17 Agustus 1945"] },

{ question:"Pengamalan sila ke-4 Pancasila paling tepat digambarkan oleh...", correct:"Mengutamakan musyawarah dalam mengambil keputusan untuk kepentingan bersama", options:["Membantu orang tua menyeberang jalan","Berdoa sebelum belajar","Cinta produk dalam negeri","Mengutamakan musyawarah dalam mengambil keputusan untuk kepentingan bersama"] },

{ question:"Anda menemukan dompet tergeletak di koridor kantor yang sepi. Apa tindakan Anda?", correct:"Menyerahkannya ke bagian keamanan atau HRD tanpa mengambil isinya", options:["Mengambil isinya lalu membuang dompetnya","Menunggu pemiliknya datang di tempat tersebut sampai jam pulang","Menyerahkannya ke bagian keamanan atau HRD tanpa mengambil isinya","Membiarkannya saja karena bukan urusan Anda"] },

{ question:"Sinonim dari kata 'EKSODUS' adalah...", correct:"Pengungsian", options:["Pemasukan","Pengungsian","Perjalanan","Pemukiman"] },

{ question:"Antonim dari kata 'PROGRESIF' adalah...", correct:"Statis", options:["Aktif","Modern","Statis","Cepat"] },

{ question:"Sebuah bus berangkat pukul 08.00 dengan kecepatan 60 km/jam. Jika jarak tujuan 180 km, pukul berapa bus sampai?", correct:"11.00", options:["10.00","10.30","11.00","11.30"] },

{ question:"Sumpah Pemuda dibacakan pada tanggal...", correct:"28 Oktober 1928", options:["20 Mei 1908","17 Agustus 1945","28 Oktober 1928","10 November 1945"] },

{ question:"Amandemen UUD 1945 telah dilakukan sebanyak...", correct:"4 kali", options:["2 kali","3 kali","4 kali","5 kali"] },

{ question:"Dalam mengerjakan tugas kelompok, rekan Anda malas-malasan. Sikap Anda...", correct:"Menegurnya dengan baik dan membagi ulang tugas agar ia berkontribusi", options:["Mengerjakan semuanya sendiri agar cepat selesai","Menghapusnya dari daftar anggota kelompok","Menegurnya dengan baik dan membagi ulang tugas agar ia berkontribusi","Ikut-ikutan malas agar adil"] },

{ question:"Negara yang tidak termasuk pendiri ASEAN adalah...", correct:"Vietnam", options:["Indonesia","Filipina","Thailand","Vietnam"] },

{ question:"Lambang negara Garuda Pancasila dirancang oleh...", correct:"Sultan Hamid II", options:["Muh. Yamin","Ir. Soekarno","Sultan Hamid II","Mr. Soepomo"] },

{ question:"Jika hari ini adalah hari Rabu, maka 100 hari lagi adalah hari...", correct:"Jumat", options:["Kamis","Jumat","Sabtu","Minggu"] },

{ question:"Nilai dari 0,75 + 1/4 + 25% adalah...", correct:"1,25", options:["1,00","1,25","1,50","1,75"] },

{ question:"Bhinneka Tunggal Ika diambil dari kitab Sutasoma karangan...", correct:"Mpu Tantular", options:["Mpu Prapanca","Mpu Tantular","Mpu Sedah","Mpu Panuluh"] },

{ question:"Analogi: GURU : SEKOLAH = ... : ...", correct:"Penebang : Hutan", options:["Obat : Apotek","Penebang : Hutan","Supir : Mobil","Pasien : Rumah Sakit"] },

{ question:"Siapakah yang mengetik naskah proklamasi Indonesia?", correct:"Sayuti Melik", options:["Laksamana Maeda","Sukarni","Sayuti Melik","B.M. Diah"] },

{ question:"Mana yang bukan merupakan pahlawan revolusi?", correct:"Pangeran Diponegoro", options:["Ahmad Yani","D.I. Panjaitan","Pangeran Diponegoro","Pierre Tendean"] },

{ question:"Ibu kota negara Kalimantan Timur yang baru (IKN) bernama...", correct:"Nusantara", options:["Penajam","Nusantara","Balikpapan","Samarinda"] },

{ question:"Hasil dari (25 x 4) + (50 : 2) adalah...", correct:"125", options:["100","125","150","175"] },

{ question:"Hak DPR untuk melakukan penyelidikan terhadap kebijakan pemerintah disebut hak...", correct:"Angket", options:["Interpelasi","Angket","Menyatakan Pendapat","Imunitas"] },

{ question:"Sikap mencintai tanah air dan bangsa secara berlebihan disebut...", correct:"Chauvinisme", options:["Patriotisme","Nasionalisme","Chauvinisme","Etnosentrisme"] },

{ question:"Jika x = 2 dan y = 5, maka nilai dari x^2 + 2xy + y^2 adalah...", correct:"49", options:["25","36","49","64"] },

{ question:"Semboyan 'Ing Ngarsa Sung Tuladha' dikemukakan oleh...", correct:"Ki Hajar Dewantara", options:["Raden Ajen Kartini","Ki Hajar Dewantara","Dr. Sutomo","HOS Cokroaminoto"] },

{ question:"Negara Indonesia adalah negara hukum. Hal ini tertuang dalam UUD 1945 pasal...", correct:"Pasal 1 ayat 3", options:["Pasal 1 ayat 1","Pasal 1 ayat 2","Pasal 1 ayat 3","Pasal 2 ayat 1"] },

{ question:"Petani : Cangkul = ... : ...", correct:"Penjahit : Jarum", options:["Nelayan : Laut","Penjahit : Jarum","Guru : Murid","Dokter : Obat"] },

{ question:"Angka yang tepat untuk mengisi titik-titik: 1, 3, 6, 10, ...", correct:"15", options:["12","14","15","18"] },

{ question:"Sila yang menjadi payung bagi sila-sila lainnya adalah sila ke...", correct:"1", options:["1","2","3","5"] },

{ question:"Badan yang menggantikan BPUPKI adalah...", correct:"PPKI", options:["KNIP","PPKI","DPRD","MPR"] }

];
/* ================= SEND QUIZ ================= */

async function sendQuiz(guild){

if(activeQuiz) return;

const channel=guild.channels.cache.get(process.env.QUIZ_CHANNEL_ID);
if(!channel) return;

const q=questions[Math.floor(Math.random()*questions.length)];
const shuffled=shuffle([...q.options]);
const correctIndex=shuffled.indexOf(q.correct);

const embed = new EmbedBuilder()
.setTitle("🧠 QUIZ RAMADHAN FEST")
.setDescription(
`━━━━━━━━━━━━━━━━━━\n`+
`📢 **PERTANYAAN BARU!**\n\n`+

`❓ **${q.question}**\n\n`+

`🇦 **${shuffled[0]}**\n`+
`🇧 **${shuffled[1]}**\n`+
`🇨 **${shuffled[2]}**\n`+
`🇩 **${shuffled[3]}**\n\n`+

`━━━━━━━━━━━━━━━━━━\n`+

`⏳ **Waktu menjawab: 45 menit**\n`+
`🔥 **Jawaban pertama = 2x poin!**\n`+
`🏆 **Kejar leaderboard sekarang!**`
)
.setColor("Gold")
.setFooter({text:"Ramadhan Fest Quiz Event"})
.setTimestamp();

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder().setCustomId("0").setLabel("🇦").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("1").setLabel("🇧").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("2").setLabel("🇨").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("3").setLabel("🇩").setStyle(ButtonStyle.Primary)

);

const msg=await channel.send({

content:`<@&${process.env.GIVEAWAY_ROLE_ID}> 🎉 Quiz baru muncul!`,
embeds:[embed],
components:[row]

});

activeQuiz={
correct:correctIndex,
answered:[],
winners:[],
firstWinner:null
};

setTimeout(async()=>{

try{

if(!activeQuiz){
console.log("Quiz expired but already cleared")
return
}

await msg.edit({components:[]});

let result="📊 **HASIL QUIZ**\n\n";

/* ===== JAWABAN BENAR ===== */

const correctAnswer = shuffled[correctIndex];

result += `✅ **Jawaban benar: ${correctAnswer}**\n\n`;

if(activeQuiz.winners.length===0){

result+="❌ Tidak ada yang menjawab benar.";

}else{

result+="🏆 **Jawaban tercepat:**\n";

activeQuiz.winners.forEach((w,i)=>{
result+=`${i+1}. <@${w.id}> — +${w.points} poin\n`;
});

/* ===== LIST SEMUA YANG BENAR ===== */

result+="\n✨ **Semua yang menjawab benar:**\n";

activeQuiz.winners.forEach(w=>{
result+=`<@${w.id}> `;
});

}

channel.send(result);

activeQuiz=null;

}catch(err){
console.error("Quiz result error:",err)
}

},45*60*1000)

}

/* ================= AUTO QUIZ TIAP JAM ================= */

function startAutoQuizSystem(guild){

let lastQuizHour = null

setInterval(async()=>{

const now = new Date()

const minute = now.getMinutes()
const hour = now.getHours()

if(minute > 1) return

if(lastQuizHour === hour) return

lastQuizHour = hour

if(!activeQuiz){

await sendQuiz(guild)

}

},60000)

}

/* ================= INTERACTION ================= */

client.on("interactionCreate",async interaction=>{

if(interaction.isButton() && ["0","1","2","3"].includes(interaction.customId)){

await interaction.deferReply({ephemeral:true})

if(!activeQuiz)
return interaction.editReply({
content:"⚠️ Soal selesai."
});

if(activeQuiz.answered.includes(interaction.user.id))
return interaction.editReply({content:"❌ Kamu sudah menjawab.",ephemeral:true});

activeQuiz.answered.push(interaction.user.id);

if(parseInt(interaction.customId)===activeQuiz.correct){

const user=getUser(interaction.user.id);

let reward = 150;

if(!activeQuiz.firstWinner){
reward*=2;
activeQuiz.firstWinner=interaction.user.id;
}

user.points+=reward;

activeQuiz.winners.push({
id:interaction.user.id,
points:reward
});

saveData();

await updateLeaderboard(interaction.guild);

await logPoint(interaction.guild,interaction.user.id,reward,"Quiz");

return interaction.editReply({
content:`🔥 Benar!\n✨ +${reward} poin\n🏆 Total: ${user.points}`,
ephemeral:true
});

}

return interaction.editReply({content:"❌ Salah!",ephemeral:true});

}

if(!interaction.isChatInputCommand()) return;

/* ================= ADD POIN ================= */

if(interaction.commandName==="addpoin"){

if(interaction.user.id!==OWNER_ID)
return interaction.reply({
content:"❌ Owner only.",
ephemeral:true
});

const target=interaction.options.getUser("user");
const amount=interaction.options.getInteger("jumlah");

const user=getUser(target.id);

user.points+=amount;

saveData();

await updateLeaderboard(interaction.guild);

await logPoint(
interaction.guild,
target.id,
amount,
"Manual add poin"
);

return interaction.reply({
content:`✅ ${amount} poin berhasil ditambahkan ke ${target}`,
ephemeral:true
});

}

if(interaction.commandName==="cooldown"){

const user = getUser(interaction.user.id);
const now = Date.now();

let text = "🌙 **STATUS COOLDOWN** 🌙\n";
text += "━━━━━━━━━━━━━━━━━━\n\n";

for(const key in keywordCooldown){

const cd = user.keywordCooldowns[key] || 0;

if(now >= cd){

text += `✨ **${key.toUpperCase()}** : 🟢 Siap digunakan\n`;

}else{

const remain = Math.ceil((cd - now)/60000);
text += `⏳ **${key.toUpperCase()}** : ${remain} menit lagi\n`;

}

}

text += "\n━━━━━━━━━━━━━━━━━━";
text += `\n🏆 Total Poin Kamu: **${user.points} poin**`;

return interaction.reply({
content:text,
ephemeral:true
});

}

if(interaction.commandName==="soal"){

await sendQuiz(interaction.guild);

return interaction.reply({
content:"📢 Quiz dikirim!",
ephemeral:true
});

}

});

/* ================= READY ================= */

client.once("clientReady",async()=>{

console.log("BOT ONLINE - SYSTEM AKTIF");

const guild = client.guilds.cache.get(process.env.GUILD_ID);

if(!guild) return;

startAutoQuizSystem(guild);
startBossSchedule(guild);
startCountdown(guild);

});

setTimeout(() => {
client.login(process.env.TOKEN);
}, 5000);

/* =====================================================
🐉 RAMADHAN BOSS RAID PRO
===================================================== */

let raidBoss=null
let raidMessage=null
let raidPlayers={}
let attackCooldown={}

const RAID_HP=8000

let updatePending=false

/* ================= HP BAR ================= */

function raidHPBar(current,max){

const size=20
const percent=current/max

const filled=Math.round(size*percent)
const empty=size-filled

return "🟥".repeat(filled)+"⬛".repeat(empty)

}

/* ================= UPDATE ================= */

async function updateRaid(){

if(!raidMessage) return

const sorted=Object.entries(raidPlayers)
.sort((a,b)=>b[1]-a[1])
.slice(0,5)

let leaderboard=""

sorted.forEach((p,i)=>{
leaderboard+=`${i+1}. <@${p[0]}> — ${p[1]} dmg\n`
})

if(!leaderboard) leaderboard="Belum ada serangan"

const embed=new EmbedBuilder()

.setTitle("🐉 RAMADHAN BOSS RAID")

.setDescription(`
HP: **${raidBoss.hp} / ${raidBoss.max}**

${raidHPBar(raidBoss.hp,raidBoss.max)}

🏆 Top Damage

${leaderboard}
`)

.setColor("Red")

await raidMessage.edit({embeds:[embed]})

}

/* ================= SAFE UPDATE ================= */

function safeUpdate(){

if(updatePending) return

updatePending=true

setTimeout(async()=>{

await updateRaid()

updatePending=false

},800)

}

/* ================= SPAWN ================= */

async function spawnRaid(guild){

if(raidBoss) return

const channel=guild.channels.cache.get(process.env.BOSS_CHANNEL_ID)
if(!channel) return

raidPlayers={}
attackCooldown={}

raidBoss={
hp:RAID_HP,
max:RAID_HP
}

const embed=new EmbedBuilder()

.setTitle("🐉 BOSS RAMADHAN MUNCUL!")

.setDescription(`
HP: **${raidBoss.hp} / ${raidBoss.max}**

${raidHPBar(raidBoss.hp,raidBoss.max)}

⚔️ Attack boss untuk menyerang!
`)

.setColor("Red")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("raid_attack")
.setLabel("⚔️ Attack")
.setStyle(ButtonStyle.Danger)

)

raidMessage=await channel.send({

content:`<@&${process.env.GIVEAWAY_ROLE_ID}> 🐉 **Boss Ramadhan muncul!**`,
embeds:[embed],
components:[row]

})

}

/* ================= BOSS DEAD ================= */

async function raidDead(guild){

const channel=guild.channels.cache.get(process.env.BOSS_CHANNEL_ID)

const sorted=Object.entries(raidPlayers)
.sort((a,b)=>b[1]-a[1])

let result="🎉 **Boss Ramadhan dikalahkan!**\n\n"

for (let i = 0; i < sorted.slice(0,10).length; i++) {

const p = sorted[i]

const user = getUser(p[0])

let reward = 100

if(i===0) reward=400
else if(i===1) reward=300
else if(i===2) reward=200

user.points += reward

await logPoint(
guild,
p[0],
reward,
"Boss Raid Reward"
)

result += `${i+1}. <@${p[0]}> — ${p[1]} dmg (+${reward} poin)\n`

}

channel.send(result)

saveData()

updateLeaderboard(guild)

raidBoss=null
raidPlayers={}
raidMessage=null
attackCooldown={}

}

/* ================= BUTTON ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return
if(interaction.customId!=="raid_attack") return
if(!raidBoss) return

const now=Date.now()

if(attackCooldown[interaction.user.id] && now<attackCooldown[interaction.user.id]){

const wait=Math.ceil((attackCooldown[interaction.user.id]-now)/1000)

return interaction.reply({
content:`⏳ Tunggu ${wait} detik sebelum menyerang lagi`,
ephemeral:true
})

}

attackCooldown[interaction.user.id]=now+3000

await interaction.deferUpdate()

const dmg=Math.floor(Math.random()*50)+30

raidBoss.hp-=dmg

if(!raidPlayers[interaction.user.id])
raidPlayers[interaction.user.id]=0

raidPlayers[interaction.user.id]+=dmg

if(raidBoss.hp<=0){

raidBoss.hp=0

await updateRaid()

await raidDead(interaction.guild)

return

}

safeUpdate()

})

/* ================= AUTO SPAWN ================= */

function startBossSchedule(guild){

let lastSpawn = null

setInterval(()=>{

const now = new Date()

let hour = now.getUTCHours()+7
const minute = now.getUTCMinutes()

if(hour>=24) hour-=24

if(minute > 2) return

if([9,15,21].includes(hour)){

if(lastSpawn !== hour){

spawnRaid(guild)
lastSpawn = hour

}

}

},60000)

}

/* ================= MANUAL COMMAND ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

if(interaction.commandName==="spawnboss"){

if(interaction.user.id!==OWNER_ID)
return interaction.reply({content:"Owner only.",ephemeral:true})

spawnRaid(interaction.guild)

interaction.reply({
content:"🐉 Boss berhasil di-spawn!",
ephemeral:true
})

}

})

/* =====================================================
🌙 RAMADHAN FEST LIBUR SYSTEM FINAL
===================================================== */

let eventPaused = false
let pauseEnd = 0

let voteActive = false
let voteYes = []
let voteNo = []
let lastVoteTime = 0

/* ================= FORMAT WAKTU ================= */

function formatTime(ms){

const totalMinutes = Math.ceil(ms/60000)

const hours = Math.floor(totalMinutes/60)
const minutes = totalMinutes % 60

return `${hours} jam ${minutes} menit`

}

/* ================= CEK EVENT LIBUR ================= */

function isEventPaused(){

if(!eventPaused) return false

if(Date.now() > pauseEnd){

eventPaused = false
return false

}

return true

}

/* ================= BLOCK QUIZ ================= */

const originalSendQuiz = sendQuiz

sendQuiz = async function(guild){

if(isEventPaused()) return

return originalSendQuiz(guild)

}

/* ================= BLOCK BOSS ================= */

const originalSpawnRaid = spawnRaid

spawnRaid = async function(guild){

if(isEventPaused()) return

return originalSpawnRaid(guild)

}

/* ================= BLOCK FARM ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return

if(!isEventPaused()) return

if(message.channel.id !== process.env.KEYWORD_CHANNEL_ID) return

const remain = pauseEnd - Date.now()

message.reply(`🌙 Ramadhan Fest sedang libur\nEvent kembali aktif dalam: **${formatTime(remain)}**`)

})

/* ================= COMMAND VOTE ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return

if(message.content !== "!votelibur") return

const now = Date.now()

/* ===== COOLDOWN 1 JAM ===== */

if(now - lastVoteTime < 3600000){

const remain = 3600000-(now-lastVoteTime)

return message.reply(`⏳ Voting baru bisa dibuat lagi dalam **${formatTime(remain)}**`)

}

if(voteActive){

return message.reply("⚠️ Voting sedang berlangsung.")

}

voteActive = true
voteYes = []
voteNo = []

const embed = new EmbedBuilder()

.setTitle("📊 VOTING LIBUR RAMADHAN FEST")

.setDescription(`

Apakah **Ramadhan Fest diliburkan sementara?**

👍 Setuju
👎 Tidak

📌 Minimal vote **5 orang**
⏳ Voting berlangsung **2 menit**

`)

.setColor("Gold")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("vote_yes")
.setLabel("👍 Setuju")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("vote_no")
.setLabel("👎 Tidak")
.setStyle(ButtonStyle.Danger)

)

const msg = await message.channel.send({

embeds:[embed],
components:[row]

})

/* ================= TIMER VOTE ================= */

setTimeout(async()=>{

const yes = voteYes.length
const no = voteNo.length
const total = yes + no

let result = `📊 **HASIL VOTING**\n\n`

result += `👍 Setuju: ${yes}\n`
result += `👎 Tidak: ${no}\n`
result += `👥 Total vote: ${total}\n\n`

if(total < 5){

result += "❌ Voting tidak valid.\nMinimal **5 orang** harus vote."

}else{

if(yes > no){

eventPaused = true
pauseEnd = Date.now() + 86400000

result += "🌙 **Ramadhan Fest diliburkan selama 24 jam.**"

}else{

result += "🎮 Event tetap berjalan."

}

}

message.channel.send(result)

voteActive = false
lastVoteTime = Date.now()

await msg.edit({components:[]})

},120000)

})

/* ================= BUTTON INTERACTION ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

if(interaction.customId === "vote_yes"){

if(voteYes.includes(interaction.user.id) || voteNo.includes(interaction.user.id)){

return interaction.reply({

content:"Kamu sudah vote.",
ephemeral:true

})

}

voteYes.push(interaction.user.id)

return interaction.reply({

content:"👍 Vote setuju tercatat.",
ephemeral:true

})

}

if(interaction.customId === "vote_no"){

if(voteYes.includes(interaction.user.id) || voteNo.includes(interaction.user.id)){

return interaction.reply({

content:"Kamu sudah vote.",
ephemeral:true

})

}

voteNo.push(interaction.user.id)

return interaction.reply({

content:"👎 Vote tidak tercatat.",
ephemeral:true

})

}

})

/* =====================================================
👑 OWNER CONTROL RAMADHAN FEST
===================================================== */

client.on("messageCreate", async message => {

if(message.author.bot) return

/* ===== PAKSA LIBUR ===== */

if(message.content === "!liburkan"){

if(message.author.id !== OWNER_ID)
return message.reply("❌ Hanya owner yang bisa menggunakan command ini.")

eventPaused = true
pauseEnd = Date.now() + 86400000

return message.channel.send(`
🌙 **Ramadhan Fest diliburkan oleh Owner**

Event akan kembali aktif dalam **24 jam**.
`)

}

/* ===== BUKA LIBUR ===== */

if(message.content === "!bukalibur"){

if(message.author.id !== OWNER_ID)
return message.reply("❌ Hanya owner yang bisa menggunakan command ini.")

eventPaused = false
pauseEnd = 0

return message.channel.send(`
🎉 **Ramadhan Fest kembali dibuka oleh Owner**

Farm, Quiz, dan Boss sudah aktif kembali!
`)

}

})

/* =====================================================
🌙 RAMADHAN FEST COUNTDOWN FINAL
===================================================== */

const LEBARAN_DATE = new Date("2026-03-20T00:00:00+07:00")

function getCountdownText(){

const now = new Date()

const diff = LEBARAN_DATE - now

const days = Math.ceil(diff / (1000*60*60*24))

if(days > 7){

return `🌙 **RAMADHAN FEST COUNTDOWN**

Sisa **${days} hari** menuju Lebaran
dan penutupan **Ramadhan Fest!**

🏆 Leaderboard masih bisa berubah
⚔️ Boss masih bisa dikalahkan
🧠 Quiz masih bisa dimenangkan

Ayo kejar posisi terbaik!`
}

if(days <= 7 && days > 3){

return `🔥 **FINAL WEEK RAMADHAN FEST**

Sisa **${days} hari** menuju penutupan event!

Leaderboard masih bisa berubah
Boss semakin brutal
Quiz semakin menentukan!

Jangan sampai kehilangan posisi!`
}

if(days <= 3 && days > 1){

return `⚡ **FINAL COUNTDOWN**

Hanya **${days} hari lagi** menuju penutupan Ramadhan Fest!

Setiap poin sangat berarti sekarang!

⚔️ Raid Boss
🧠 Quiz
🌾 Farm

Semua masih bisa mengubah leaderboard!`
}

if(days === 1){

return `👑 **HARI TERAKHIR RAMADHAN FEST**

Ini kesempatan terakhir
untuk mengubah leaderboard!

Boss terakhir akan segera muncul...

Jangan sampai menyesal!`
}

if(days <= 0){

return `🎉 **RAMADHAN FEST RESMI BERAKHIR**

Selamat kepada para juara!

Terima kasih kepada semua
yang telah berpartisipasi dalam event ini.

Sampai jumpa di event berikutnya!`
}

}

/* ================= AUTO 00:00 WIB ================= */

function startCountdown(guild){

let lastDay = null

setInterval(()=>{

const now = new Date()

let hour = now.getUTCHours() + 7
const minute = now.getUTCMinutes()

if(hour >= 24) hour -= 24

if(hour !== 0 || minute !== 0) return

const today = now.getDate()

if(lastDay === today) return

lastDay = today

const channel = guild.channels.cache.get(process.env.LEADERBOARD_CHANNEL_ID)

if(!channel) return

channel.send(getCountdownText())

},60000)

}

/* ================= COMMAND MANUAL ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return

if(message.content === "!countdown"){

message.channel.send(getCountdownText())

}

})

/* =====================================================
📢 RAMADHAN FEST ANNOUNCEMENT SYSTEM
===================================================== */

client.on("messageCreate", async message => {

if(message.author.bot) return

if(!message.content.startsWith("!announce")) return

if(message.author.id !== OWNER_ID)
return message.reply("❌ Hanya owner yang bisa menggunakan command ini.")

const args = message.content.split(" ")

if(!args[1]) 
return message.reply("Gunakan format:\n`!announce #channel pesan`")

/* ===== CHANNEL TUJUAN ===== */

const channel = message.mentions.channels.first()

if(!channel)
return message.reply("Tag channel tujuan.\nContoh: `!announce #general pesan`")

/* ===== AMBIL PESAN ===== */

const text = message.content
.replace("!announce","")
.replace(`<#${channel.id}>`,"")
.trim()

if(!text) 
return message.reply("Tulis pesan pengumuman.")

/* ===== EMBED ===== */

const embed = new EmbedBuilder()

.setTitle("📢 PENGUMUMAN RAMADHAN FEST")

.setDescription(text)

.setColor("Gold")

.setFooter({
text:"Ramadhan Fest Official System"
})

.setTimestamp()

/* ===== KIRIM ===== */

channel.send({embeds:[embed]})

message.react("✅")

})

/* =====================================================
📢 RAMADHAN FEST FORWARD IMAGE ANNOUNCEMENT
===================================================== */

client.on("messageCreate", async message => {

if(message.author.bot) return
if(!message.content.startsWith("!send")) return

if(message.author.id !== OWNER_ID)
return message.reply("❌ Owner only.")

const channel = message.mentions.channels.first()

if(!channel)
return message.reply("Format:\n!send #channel pesan")

/* ambil pesan */

const text = message.content
.replace("!send","")
.replace(`<#${channel.id}>`,"")
.trim()

/* ambil gambar */

const attachment = message.attachments.first()

if(!attachment)
return message.reply("Lampirkan gambar.")

/* kirim */

channel.send({
content:text,
files:[attachment.url]
})

message.react("✅")

})