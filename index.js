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

function getRankInfo(userId){
const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points);
const rankIndex = sorted.findIndex(e=>e[0]===userId);
const rank = rankIndex + 1;
const firstPoints = sorted.length ? sorted[0][1].points : 0;
const userPoints = data[userId]?.points || 0;
const gap = firstPoints - userPoints;
return {
rank,
gap
};

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

const channel = guild.channels.cache.get(process.env.HISTORY_CHANNEL_ID)
if(!channel) return

let emoji = "✨"

if(reason.includes("Quiz")) emoji = "🧠"
if(reason.includes("Boss")) emoji = "🐉"
if(reason.includes("Hadiah")) emoji = "🎁"
if(reason.includes("Keyword")) emoji = "🌙"

const embed = new EmbedBuilder()

.setTitle("📜 HISTORY POIN RAMADHAN FEST")

.setDescription(`
👤 Player
<@${userId}>

${emoji} Event
${reason}

💰 Poin
+${amount}
`)

.setColor("Gold")
.setTimestamp()

channel.send({embeds:[embed]})

}

/* ================= RANK BALANCE ================= */

function applyRankBalance(userId,baseReward){

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points);

const rankIndex=sorted.findIndex(e=>e[0]===userId);

if(rankIndex===-1) return baseReward;

const multipliers=[
1.00, // rank1
1.05, // rank2
1.10, // rank3
1.15, // rank4
1.20  // rank5
];

const multi=multipliers[rankIndex]||2.0;

return Math.floor(baseReward*multi);

}

/* ================= GAP BALANCE ================= */

function applyGapBalance(userId,baseReward){

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points);

if(sorted.length<2) return baseReward;

const gap=sorted[0][1].points-sorted[1][1].points;
const rankIndex=sorted.findIndex(e=>e[0]===userId);

if(gap>1200){
if(rankIndex>=1) return Math.floor(baseReward*1.90);
}

if(gap>1000){
if(rankIndex>=1) return Math.floor(baseReward*1.75);
}

if(gap>750){
if(rankIndex>=1) return Math.floor(baseReward*1.50);
}

if(gap>500){
if(rankIndex>=1) return Math.floor(baseReward*1.35);
}

if(gap>250){
if(rankIndex>=1) return Math.floor(baseReward*1.20);
}

if(gap>100){
if(rankIndex>=1) return Math.floor(baseReward*1.10);
}

return baseReward;

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

client.on("messageCreate",async message=>{

if(message.author.bot) return

/* ================= COMMAND HADIAH ================= */

if(message.content === "!hadiah"){

if(message.author.id !== OWNER_ID) return

spawnHadiah(message.guild)

return message.reply("🎁 Hadiah berhasil di-spawn!")

}

/* ================= KEYWORD SYSTEM ================= */

if(message.channel.id!==process.env.KEYWORD_CHANNEL_ID) return;

const content=message.content.toLowerCase().trim();
if(!keywordCooldown[content]) return;

const user=getUser(message.author.id);
const now=Date.now();

if(now<(user.keywordCooldowns[content]||0)){

const remain=Math.ceil((user.keywordCooldowns[content]-now)/60000);
return message.reply(`⏳ Tunggu ${remain} menit lagi.`);

}

let reward=Math.floor(Math.random()*10)+10;

reward=applyRankBalance(message.author.id,reward);
reward=applyGapBalance(message.author.id,reward);

user.points+=reward;
user.keywordCooldowns[content]=now+keywordCooldown[content];

saveData();

await updateLeaderboard(message.guild);

await logPoint(message.guild,message.author.id,reward,"Keyword Ramadhan");

const info = getRankInfo(message.author.id);

const text = info.rank !== 1
? `📉 **${info.gap} poin lagi untuk mengejar rank #1**`
: `👑 **Kamu sedang memimpin leaderboard!**`;

const embed = new EmbedBuilder()
.setColor("Gold")
.setAuthor({
name: message.author.username,
iconURL: message.author.displayAvatarURL()
})
.setDescription(
`✨ **+${reward} poin**

🏆 **Total:** ${user.points} poin
📊 **Rank:** #${info.rank}

${text}`
);

message.channel.send({embeds:[embed]});

});

/* ================= QUIZ ================= */

let activeQuiz=null;

const questions = [

{ question:"Apa yang bisa naik tetapi tidak pernah turun?", correct:"Umur", options:["Umur","Harga","Balon","Asap"] },
{ question:"Apa yang selalu datang tetapi tidak pernah tiba?", correct:"Besok", options:["Besok","Pagi","Waktu","Hari"] },
{ question:"Semakin banyak diambil semakin besar jadinya?", correct:"Lubang", options:["Lubang","Api","Air","Tanah"] },
{ question:"Apa yang memiliki banyak kunci tetapi tidak bisa membuka pintu?", correct:"Piano", options:["Piano","Keyboard","Peta","Komputer"] },
{ question:"Apa yang berjalan tanpa kaki?", correct:"Waktu", options:["Angin","Waktu","Air","Bayangan"] },
{ question:"Apa yang punya mata tetapi tidak bisa melihat?", correct:"Jarum", options:["Jarum","Boneka","Kamera","Topi"] },
{ question:"Apa yang selalu di depanmu tetapi tidak bisa dilihat?", correct:"Masa depan", options:["Udara","Masa depan","Langit","Cermin"] },
{ question:"Apa yang bisa pecah tanpa disentuh?", correct:"Janji", options:["Janji","Kaca","Balon","Gelas"] },
{ question:"Apa yang punya leher tetapi tidak punya kepala?", correct:"Botol", options:["Botol","Baju","Kursi","Gitar"] },
{ question:"Apa yang memiliki tangan tetapi tidak bisa bertepuk tangan?", correct:"Jam", options:["Jam","Robot","Boneka","Patung"] },

{ question:"Apa yang semakin kering saat semakin banyak digunakan?", correct:"Handuk", options:["Handuk","Kain","Baju","Spons"] },
{ question:"Apa yang memiliki gigi tetapi tidak bisa menggigit?", correct:"Sisir", options:["Sisir","Garpu","Kunci","Gergaji"] },
{ question:"Apa yang bisa mengisi ruangan tetapi tidak memakan tempat?", correct:"Cahaya", options:["Udara","Cahaya","Angin","Suara"] },
{ question:"Apa yang selalu basah saat mengeringkan sesuatu?", correct:"Handuk", options:["Handuk","Air","Spons","Sabun"] },
{ question:"Apa yang memiliki satu mata tetapi tidak bisa melihat?", correct:"Jarum", options:["Jarum","Robot","Kamera","Boneka"] },
{ question:"Apa yang semakin besar semakin sedikit terlihat?", correct:"Kegelapan", options:["Kegelapan","Kabut","Bayangan","Awan"] },
{ question:"Apa yang bisa kamu tangkap tetapi tidak bisa kamu lempar?", correct:"Flu", options:["Flu","Air","Angin","Debu"] },
{ question:"Apa yang punya kota tetapi tidak punya rumah?", correct:"Peta", options:["Peta","Atlas","Globe","Buku"] },
{ question:"Apa yang bisa berbicara tanpa mulut?", correct:"Gema", options:["Gema","Radio","Air","Angin"] },
{ question:"Apa yang selalu bergerak tetapi tidak pernah pergi dari tempatnya?", correct:"Jam", options:["Jam","Air","Angin","Bayangan"] },

{ question:"Apa yang semakin dipakai semakin habis?", correct:"Lilin", options:["Lilin","Baterai","Sabun","Air"] },
{ question:"Apa yang punya sayap tetapi tidak bisa terbang?", correct:"Ayam", options:["Ayam","Pesawat","Burung","Kupu"] },
{ question:"Apa yang punya kaki tetapi tidak bisa berjalan?", correct:"Meja", options:["Meja","Kursi","Lemari","Sofa"] },
{ question:"Apa yang selalu naik tetapi tidak pernah turun selain umur?", correct:"Tangga", options:["Tangga","Asap","Balon","Uap"] },
{ question:"Apa yang punya kepala dan ekor tetapi tidak punya badan?", correct:"Koin", options:["Koin","Ular","Kadal","Ikan"] },
{ question:"Apa yang punya banyak lubang tetapi tetap menahan air?", correct:"Spons", options:["Spons","Kain","Sabun","Botol"] },
{ question:"Apa yang bisa dilihat tetapi tidak bisa disentuh?", correct:"Bayangan", options:["Bayangan","Air","Udara","Kabut"] },
{ question:"Apa yang selalu mengikuti kamu tetapi tidak bisa disentuh?", correct:"Bayangan", options:["Bayangan","Angin","Udara","Suara"] },
{ question:"Apa yang selalu lebih besar saat dibalik?", correct:"Angka 6", options:["Angka 6","Angka 9","Angka 8","Angka 3"] },
{ question:"Apa yang bisa kamu dengar tetapi tidak bisa kamu lihat?", correct:"Suara", options:["Suara","Angin","Udara","Air"] },

{ question:"Apa yang punya banyak halaman tetapi bukan buku?", correct:"Kalender", options:["Kalender","Peta","Majalah","Poster"] },
{ question:"Apa yang selalu jatuh tetapi tidak pernah terluka?", correct:"Hujan", options:["Hujan","Daun","Bola","Air"] },
{ question:"Apa yang bisa berlari tetapi tidak punya kaki?", correct:"Air", options:["Air","Angin","Api","Awan"] },
{ question:"Apa yang bisa makan tetapi tidak pernah kenyang?", correct:"Api", options:["Api","Angin","Air","Tanah"] },
{ question:"Apa yang bisa terbang tanpa sayap?", correct:"Waktu", options:["Waktu","Angin","Debu","Awan"] },
{ question:"Apa yang punya banyak cincin tetapi tidak punya jari?", correct:"Pohon", options:["Pohon","Planet","Bola","Saturnus"] },
{ question:"Apa yang bisa memantul tetapi bukan bola?", correct:"Suara", options:["Suara","Air","Cahaya","Angin"] },
{ question:"Apa yang bisa pecah tetapi tidak pernah terlihat?", correct:"Keheningan", options:["Keheningan","Janji","Kaca","Balon"] },
{ question:"Apa yang punya banyak wajah tetapi tidak punya kepala?", correct:"Dadu", options:["Dadu","Jam","Topeng","Koin"] },
{ question:"Apa yang selalu ada tetapi tidak pernah terlihat?", correct:"Udara", options:["Udara","Angin","Kabut","Awan"] },

{ question:"Apa yang selalu berlari tetapi tidak pernah lelah?", correct:"Sungai", options:["Sungai","Air","Angin","Awan"] },
{ question:"Apa yang semakin besar semakin ringan?", correct:"Balon", options:["Balon","Awan","Asap","Udara"] },
{ question:"Apa yang memiliki jantung tetapi tidak hidup?", correct:"Artichoke", options:["Artichoke","Kubis","Bawang","Kentang"] },
{ question:"Apa yang bisa terbuka tetapi bukan pintu?", correct:"Buku", options:["Buku","Jendela","Kotak","Tas"] },
{ question:"Apa yang punya banyak cabang tetapi bukan pohon?", correct:"Bank", options:["Bank","Sungai","Peta","Jalan"] },
{ question:"Apa yang semakin diisi semakin ringan?", correct:"Balon", options:["Balon","Botol","Tas","Kotak"] },
{ question:"Apa yang bisa dipatahkan tanpa disentuh?", correct:"Janji", options:["Janji","Kayu","Kaca","Balon"] },
{ question:"Apa yang memiliki banyak titik tetapi tidak bergerak?", correct:"Dadu", options:["Dadu","Peta","Bintang","Domino"] },
{ question:"Apa yang selalu berada di belakang tetapi tidak terlihat?", correct:"Masa lalu", options:["Masa lalu","Bayangan","Udara","Langit"] },
{ question:"Apa yang punya banyak jari tetapi tidak hidup?", correct:"Sarung tangan", options:["Sarung tangan","Sepatu","Kaos kaki","Topi"] },

{ question:"Apa yang semakin tinggi semakin dingin?", correct:"Gunung", options:["Gunung","Langit","Awan","Udara"] },
{ question:"Apa yang selalu jatuh tetapi tidak pernah menyentuh tanah?", correct:"Malam", options:["Malam","Kabut","Awan","Bayangan"] },
{ question:"Apa yang selalu tumbuh tetapi tidak hidup?", correct:"Bayangan", options:["Bayangan","Kabut","Awan","Udara"] },
{ question:"Apa yang bisa hilang saat disebutkan?", correct:"Rahasia", options:["Rahasia","Nama","Suara","Kata"] },
{ question:"Apa yang bisa kamu pegang tetapi tidak bisa kamu lihat?", correct:"Napas", options:["Napas","Udara","Angin","Asap"] },

{ question:"Apa yang punya banyak jalan tetapi tidak bisa dilalui?", correct:"Peta", options:["Peta","Atlas","Globe","Poster"] },
{ question:"Apa yang punya banyak mata tetapi tidak bisa melihat?", correct:"Kentang", options:["Kentang","Jarum","Boneka","Robot"] },
{ question:"Apa yang punya banyak gigi tetapi tidak makan?", correct:"Sisir", options:["Sisir","Gergaji","Garpu","Pisau"] },
{ question:"Apa yang punya kepala tetapi tidak punya otak?", correct:"Kubis", options:["Kubis","Batu","Botol","Meja"] },
{ question:"Apa yang punya lidah tetapi tidak bisa berbicara?", correct:"Sepatu", options:["Sepatu","Tas","Topi","Baju"] },

{ question:"Apa yang bisa kamu lihat sekali dalam setahun?", correct:"Ulang tahun", options:["Ulang tahun","Tahun baru","Liburan","Festival"] },
{ question:"Apa yang selalu berubah tetapi tetap sama?", correct:"Waktu", options:["Waktu","Hari","Langit","Cuaca"] },
{ question:"Apa yang semakin dicari semakin sulit ditemukan?", correct:"Kesalahan", options:["Kesalahan","Kebenaran","Jawaban","Petunjuk"] },
{ question:"Apa yang bisa memotong tetapi tidak memiliki pisau?", correct:"Waktu", options:["Waktu","Air","Angin","Cahaya"] },
{ question:"Apa yang memiliki banyak warna tetapi tidak terlihat saat gelap?", correct:"Pelangi", options:["Pelangi","Bunga","Langit","Lampu"] }

]

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
.setDescription(`
━━━━━━━━━━━━━━━━━━
📢 **PERTANYAAN BARU!**

❓ **${q.question}**

🇦 **${shuffled[0]}**
🇧 **${shuffled[1]}**
🇨 **${shuffled[2]}**
🇩 **${shuffled[3]}**

━━━━━━━━━━━━━━━━━━

⏳ **Waktu menjawab: 45 menit**
🔥 **Jawaban pertama = 2x poin!**
`)

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

if(!activeQuiz) return;

await msg.edit({components:[]});

let result="📊 **HASIL QUIZ**\n\n";

if(activeQuiz.winners.length===0){
result+="❌ Tidak ada yang menjawab benar.";
}else{

activeQuiz.winners.forEach((w,i)=>{
result+=`${i+1}. <@${w.id}> — +${w.points} poin\n`;
});

}

channel.send(result);

activeQuiz=null;

},45*60*1000);

}

/* ================= AUTO QUIZ TIAP JAM ================= */

function startAutoQuizSystem(guild){

function scheduleNext(){

const now=new Date();

const next=new Date(now);

next.setMinutes(0);
next.setSeconds(0);
next.setMilliseconds(0);
next.setHours(next.getHours()+1);

const delay=next-now;

setTimeout(async()=>{

if(!activeQuiz){
await sendQuiz(guild);
}

scheduleNext();

},delay);

}

scheduleNext();

}

/* ================= INTERACTION ================= */

client.on("interactionCreate",async interaction=>{

if(interaction.isButton() && ["0","1","2","3"].includes(interaction.customId)){

if(!activeQuiz)
return interaction.reply({content:"⚠️ Soal selesai.",ephemeral:true});

if(activeQuiz.answered.includes(interaction.user.id))
return interaction.reply({content:"❌ Kamu sudah menjawab.",ephemeral:true});

activeQuiz.answered.push(interaction.user.id);

if(parseInt(interaction.customId)===activeQuiz.correct){

const user=getUser(interaction.user.id);

let reward=Math.floor(Math.random()*11)+40;

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points);

const rankIndex=sorted.findIndex(e=>e[0]===interaction.user.id);

if(rankIndex>=2){
reward=Math.floor(reward*1.7);
}

if(!activeQuiz.firstWinner){
reward*=2;
activeQuiz.firstWinner=interaction.user.id;
}

reward=applyRankBalance(interaction.user.id,reward);
reward=applyGapBalance(interaction.user.id,reward);

user.points+=reward;
activeQuiz.winners.push({
id:interaction.user.id,
points:reward
});

saveData();

await updateLeaderboard(interaction.guild);

await logPoint(interaction.guild,interaction.user.id,reward,"Quiz");

return interaction.reply({
content:`🔥 Benar!\n✨ +${reward} poin\n🏆 Total: ${user.points}`,
ephemeral:true
});

}

return interaction.reply({content:"❌ Salah!",ephemeral:true});

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
startHadiahRandom(guild);

});

client.login(process.env.TOKEN);

/* =====================================================
🐉 RAMADHAN BOSS RAID PRO
===================================================== */

let raidBoss=null
let raidMessage=null
let raidPlayers={}
let attackCooldown={}

const RAID_HP=4000

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

.setTitle("🐉 RAMADHAN BOSS MENGAMUK")

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

for(const [i,p] of sorted.slice(0,10).entries()){

const user=getUser(p[0])

let reward=50

if(i===0) reward=300
else if(i===1) reward=200
else if(i===2) reward=100

user.points+=reward

logPoint(guild,p[0],reward,"Boss Ramadhan")

result+=`${i+1}. <@${p[0]}> — ${p[1]} dmg (+${reward} poin)\n`

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

if(hour >= 24) hour -= 24

if(minute !== 0) return

if([9,15,21].includes(hour)){

if(lastSpawn !== hour){

spawnRaid(guild)
lastSpawn = hour

}

}

},30000)

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
🎁 HADIAH RAMADHAN
===================================================== */

let hadiahActive = null
let hadiahToday = 0
let hadiahTarget = 7

/* queue system */

let hadiahQueue = []
let missCount = {}
let calledToday = new Set()
let lastCalled = null

function shuffle(arr){
return arr.sort(()=>Math.random()-0.5)
}

function getNextTarget(users){

if(!hadiahQueue.length){
hadiahQueue = shuffle([...users])
}

for(let i=0;i<hadiahQueue.length;i++){

const user = hadiahQueue[i]

if(user===lastCalled) continue
if((missCount[user]||0)>=2) continue

if(!calledToday.has(user)){

hadiahQueue.splice(i,1)

lastCalled = user
calledToday.add(user)

return user

}

}

for(let i=0;i<hadiahQueue.length;i++){

const user = hadiahQueue[i]

if(user===lastCalled) continue
if((missCount[user]||0)>=2) continue

hadiahQueue.splice(i,1)

lastCalled = user

return user

}

return null

}

function getRank(userId){

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

return sorted.findIndex(e=>e[0]===userId)+1

}

function getReward(rank){

if(Math.random() < 0.05){
return 500
}

if(rank===1) return Math.floor(Math.random()*20)+20
if(rank===2) return Math.floor(Math.random()*30)+40
if(rank===3) return Math.floor(Math.random()*40)+70
if(rank<=5) return Math.floor(Math.random()*60)+100
if(rank<=10) return Math.floor(Math.random()*90)+150

return Math.floor(Math.random()*150)+220

}

async function spawnHadiah(guild){

if(hadiahActive) return

const channel = guild.channels.cache.get(process.env.HADIAH_CHANNEL_ID)
if(!channel) return

const members = await guild.members.fetch()

const users = members
.filter(m=>!m.user.bot)
.map(m=>m.id)

if(!users.length) return

const target = getNextTarget(users)
if(!target) return

hadiahActive = {
user:target,
expire:Date.now()+180000
}

const embed = new EmbedBuilder()
.setTitle("🎁 HADIAH POIN RAMADHAN")
.setDescription(`
🎉 Hadiah muncul!

<@${target}>

Ketik **ambil**

⏳ Waktu claim: 3 menit
`)
.setColor("Gold")

channel.send({
content:`<@${target}>`,
embeds:[embed]
})

setTimeout(()=>{

if(hadiahActive){

const user = hadiahActive.user

missCount[user] = (missCount[user]||0)+1
hadiahQueue.push(user)

hadiahActive = null

spawnHadiah(guild)

}

},180000)

}

/* ================= CLAIM ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return
if(!hadiahActive) return

if(message.author.id===hadiahActive.user){

if(message.content.toLowerCase()==="ambil"){

const rank = getRank(message.author.id)
let reward = getReward(rank)

reward = applyRankBalance(message.author.id,reward)
reward = applyGapBalance(message.author.id,reward)

const user = getUser(message.author.id)

user.points += reward

await logPoint(message.guild,message.author.id,reward,"Hadiah Ramadhan")

saveData()

await updateLeaderboard(message.guild)

message.channel.send(`
🎉 **HADIAH BERHASIL DIAMBIL!**

👤 Pemenang : <@${message.author.id}>
💰 Hadiah : **${reward} poin**

🔥 Ayo Semangat Kumpulkan Poin!
`)

missCount[message.author.id] = 0
hadiahQueue.push(message.author.id)

hadiahActive = null

}

}

})

/* ================= COMMAND ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

if(interaction.commandName==="hadiah"){

if(interaction.user.id!==OWNER_ID)
return interaction.reply({
content:"❌ Owner only.",
ephemeral:true
})

spawnHadiah(interaction.guild)

interaction.reply({
content:"🎁 Hadiah berhasil di-spawn!",
ephemeral:true
})

}

})

/* ================= AUTO SPAWN ================= */

function startHadiahRandom(guild){

setInterval(()=>{

const now = new Date()

if(now.getHours()===0 && now.getMinutes()===0){

hadiahToday = 0
hadiahTarget = 6 + Math.floor(Math.random()*3)

hadiahQueue = []
missCount = {}
calledToday.clear()
lastCalled = null

}

if(hadiahToday < hadiahTarget){

if(Math.random() < 0.15){

spawnHadiah(guild)

hadiahToday++

}

}

},1800000)

}