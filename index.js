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

function applyGapBalance(userId,baseReward){

const sorted=Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points);

if(sorted.length<3) return baseReward;

const gap=sorted[0][1].points-sorted[2][1].points;
const rankIndex=sorted.findIndex(e=>e[0]===userId);

if(gap>1500){
if(rankIndex===0) return Math.floor(baseReward*0.6);
if(rankIndex===1) return Math.floor(baseReward*0.75);
if(rankIndex>=2) return Math.floor(baseReward*1.4);
}

if(gap>800){
if(rankIndex===0) return Math.floor(baseReward*0.75);
if(rankIndex===1) return Math.floor(baseReward*0.85);
if(rankIndex>=2) return Math.floor(baseReward*1.2);
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

if(message.author.bot) return;
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

reward=applyGapBalance(message.author.id,reward);

user.points+=reward;
user.keywordCooldowns[content]=now+keywordCooldown[content];

saveData();

await updateLeaderboard(message.guild);

await logPoint(message.guild,message.author.id,reward,"Keyword Ramadhan");

message.channel.send(`✨ +${reward} poin\n🏆 Total: ${user.points} poin`);

});

/* ================= QUIZ ================= */

let activeQuiz=null;

const questions=[

/* ================= MATEMATIKA ================= */

{ question: "3² + 4² = ?", correct: "25", options: ["7","12","25","49"] },
{ question: "12² - 5² = ?", correct: "119", options: ["95","119","144","169"] },
{ question: "15% dari 400?", correct: "60", options: ["40","50","60","80"] },
{ question: "2⁵ × 2 = ?", correct: "64", options: ["32","48","64","128"] },
{ question: "Akar dari 625?", correct: "25", options: ["15","20","25","30"] },
{ question: "5! = ?", correct: "120", options: ["60","100","120","150"] },
{ question: "9² - 3² = ?", correct: "72", options: ["54","63","72","81"] },
{ question: "Jika 8x = 72, maka x?", correct: "9", options: ["7","8","9","10"] },
{ question: "20% dari 250?", correct: "50", options: ["40","45","50","60"] },
{ question: "Jika 6² + 8² = ?", correct: "100", options: ["64","100","144","80"] },

/* ================= POLA ================= */

{ question: "1, 4, 9, 16, 25, ...?", correct: "36", options: ["30","35","36","49"] },
{ question: "2, 6, 12, 20, 30, ...?", correct: "42", options: ["36","40","42","48"] },
{ question: "5, 10, 20, 40, ...?", correct: "80", options: ["60","70","80","90"] },
{ question: "3, 9, 27, ...?", correct: "81", options: ["54","72","81","90"] },
{ question: "7, 14, 28, 56, ...?", correct: "112", options: ["100","108","112","120"] },

/* ================= LOGIKA ================= */

{ question: "Semakin banyak diambil semakin besar?", correct: "Lubang", options: ["Air","Lubang","Api","Angin"] },
{ question: "Jika semua A adalah B dan semua B adalah C, maka?", correct: "Semua A adalah C", options: ["Semua C adalah A","Semua A adalah C","Tidak ada hubungan","Tidak pasti"] },
{ question: "Hari ini Senin. 14 hari lagi?", correct: "Senin", options: ["Selasa","Minggu","Senin","Rabu"] },
{ question: "Jika 1 kg besi vs 1 kg kapas?", correct: "Sama berat", options: ["Besi","Kapas","Sama berat","Tergantung"] },
{ question: "100 dibagi 0?", correct: "Tidak terdefinisi", options: ["0","100","Tak hingga","Tidak terdefinisi"] },

/* ================= PENGETAHUAN UMUM ================= */

{ question: "Planet terbesar?", correct: "Jupiter", options: ["Mars","Jupiter","Saturnus","Neptunus"] },
{ question: "Ibukota Jepang?", correct: "Tokyo", options: ["Kyoto","Tokyo","Osaka","Seoul"] },
{ question: "Benua terbesar?", correct: "Asia", options: ["Afrika","Asia","Eropa","Amerika"] },
{ question: "Lambang kimia emas?", correct: "Au", options: ["Ag","Au","Fe","Em"] },
{ question: "Penemu relativitas?", correct: "Albert Einstein", options: ["Newton","Einstein","Tesla","Galileo"] },

/* ================= CAMPURAN MENANTANG ================= */

{ question: "Jika 4 orang menyelesaikan kerja 6 hari, 2 orang butuh?", correct: "12 hari", options: ["8 hari","10 hari","12 hari","14 hari"] },
{ question: "Jumlah sudut segi lima?", correct: "540°", options: ["360°","540°","720°","600°"] },
{ question: "Akar 169?", correct: "13", options: ["11","12","13","14"] },
{ question: "Jika 2³ + 3³ = ?", correct: "35", options: ["17","25","35","45"] },
{ question: "Jika 50% dari X adalah 75, maka X?", correct: "150", options: ["100","125","150","175"] },

/* ================= TRICKY RINGAN ================= */

{ question: "Dibalik, 91 menjadi?", correct: "19", options: ["16","19","61","109"] },
{ question: "Jumlah hari dalam 3 minggu?", correct: "21", options: ["18","20","21","24"] },
{ question: "Jika 0 dikali 999?", correct: "0", options: ["0","999","1","Tak hingga"] },
{ question: "Berapa sisi kubus?", correct: "6", options: ["4","6","8","12"] },
{ question: "Berapa rusuk kubus?", correct: "12", options: ["8","10","12","14"] },

/* ================= BONUS TAMBAHAN ================= */

{ question: "10² - 8² = ?", correct: "36", options: ["20","32","36","40"] },
{ question: "Jika 9x = 81?", correct: "9", options: ["7","8","9","10"] },
{ question: "Akar dari 81?", correct: "9", options: ["7","8","9","10"] },
{ question: "Jika 7² = ?", correct: "49", options: ["42","48","49","56"] },
{ question: "3 × 7 + 4 = ?", correct: "25", options: ["21","23","25","28"] },

{ question: "Jika 18 ÷ 3 × 2 = ?", correct: "12", options: ["6","9","12","18"] },
{ question: "Jumlah sudut segitiga?", correct: "180°", options: ["90°","180°","270°","360°"] },
{ question: "Jika 2x = 50?", correct: "25", options: ["20","25","30","35"] },
{ question: "Akar 256?", correct: "16", options: ["14","15","16","18"] },
{ question: "Jika 100 - 45 = ?", correct: "55", options: ["45","50","55","65"] },

{ question: "Pola: 4, 8, 16, 32, ...?", correct: "64", options: ["48","56","64","72"] },
{ question: "Jika 11² = ?", correct: "121", options: ["111","121","131","141"] },
{ question: "Jika 144 ÷ 12 = ?", correct: "12", options: ["10","11","12","14"] },
{ question: "Jika 6 × 7 = ?", correct: "42", options: ["36","40","42","48"] },
{ question: "Jika 25% dari 200 = ?", correct: "50", options: ["40","45","50","60"] },

{ question: "Jumlah bulan dalam 2 tahun?", correct: "24", options: ["20","22","24","26"] },
{ question: "Jika 2 + 2 × 2 = ?", correct: "6", options: ["8","6","4","10"] },
{ question: "Jika 1000 ÷ 10 = ?", correct: "100", options: ["10","50","100","200"] },
{ question: "Jika 81 ÷ 9 = ?", correct: "9", options: ["8","9","10","11"] },
{ question: "Jika 13 + 7 = ?", correct: "20", options: ["18","19","20","21"] }

];

/* ================= SHUFFLE ================= */

function shuffle(arr){
return arr.sort(()=>Math.random()-0.5);
}

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
`⚡ **Rank 3+ bonus poin**\n`+
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

sorted.slice(0,10).forEach((p,i)=>{

const user=getUser(p[0])

let reward=50

if(i===0) reward=300
else if(i===1) reward=200
else if(i===2) reward=100

user.points+=reward

result+=`${i+1}. <@${p[0]}> — ${p[1]} dmg (+${reward} poin)\n`

})

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

setInterval(()=>{

const now=new Date()

let hour=now.getUTCHours()+7
const minute=now.getUTCMinutes()

if(hour>=24) hour-=24

if(hour===09 && minute<=1) spawnRaid(guild)
if(hour===15 && minute<=1) spawnRaid(guild)
if(hour===21 && minute<=1) spawnRaid(guild)

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

require("./kerja.js")(client)