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

/* ===== RANK BALANCE (TOP 4) ===== */

if(rankIndex === 0) multiplier *= 1
else if(rankIndex === 1) multiplier *= 1
else if(rankIndex === 2) multiplier *= 1.3
else multiplier *= 1.5

/* ===== GAP BALANCE ===== */

if(gap < 100) multiplier *= 1
else if(gap < 300) multiplier *= 1.2
else if(gap < 600) multiplier *= 1.3
else if(gap < 1000) multiplier *= 1.4
else if(gap < 2000) multiplier *= 2
else if(gap < 4000) multiplier *= 3
else multiplier *= 1.5

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
reward = Math.max(reward,100)

if(Math.random()<0.05){
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

{ question:"Jika semua kucing adalah hewan dan beberapa hewan adalah liar, maka kesimpulan yang paling tepat adalah...", correct:"Beberapa kucing mungkin liar", options:["Semua kucing liar","Tidak ada kucing liar","Beberapa kucing mungkin liar","Semua hewan kucing"] },

{ question:"Jika 3 orang dapat menyelesaikan pekerjaan dalam 3 hari, maka 1 orang akan menyelesaikan pekerjaan itu dalam...", correct:"9 hari", options:["3 hari","6 hari","9 hari","12 hari"] },

{ question:"Jika hari ini hari Rabu, maka 10 hari lagi adalah hari...", correct:"Sabtu", options:["Jumat","Sabtu","Minggu","Senin"] },

{ question:"Jika semua bunga mawar adalah bunga dan sebagian bunga berwarna merah, maka...", correct:"Sebagian mawar mungkin merah", options:["Semua mawar merah","Tidak ada mawar merah","Sebagian mawar mungkin merah","Semua bunga mawar"] },

{ question:"Jika kamu menyalip pelari di posisi kedua dalam lomba, posisi kamu sekarang adalah...", correct:"Kedua", options:["Pertama","Kedua","Ketiga","Terakhir"] },

{ question:"Jika semua dokter adalah sarjana dan sebagian sarjana adalah peneliti, maka...", correct:"Dokter mungkin peneliti", options:["Semua dokter peneliti","Tidak ada dokter peneliti","Dokter mungkin peneliti","Semua peneliti dokter"] },

{ question:"Jika 5 mesin membuat 5 barang dalam 5 menit, maka 100 mesin membuat 100 barang dalam...", correct:"5 menit", options:["5 menit","10 menit","50 menit","100 menit"] },

{ question:"Jika kamu memiliki 10 ikan dan 5 tenggelam, berapa ikan yang tersisa?", correct:"10", options:["5","10","0","15"] },

{ question:"Jika semua burung punya sayap dan ayam adalah burung, maka...", correct:"Ayam punya sayap", options:["Ayam tidak punya sayap","Ayam punya sayap","Semua sayap ayam","Ayam bukan burung"] },

{ question:"Jika 1 kg besi dan 1 kg kapas ditimbang, mana yang lebih berat?", correct:"Sama", options:["Besi","Kapas","Sama","Tidak bisa ditentukan"] },

{ question:"Jika sebuah kereta listrik berjalan ke utara, ke mana arah asapnya?", correct:"Tidak ada asap", options:["Utara","Selatan","Barat","Tidak ada asap"] },

{ question:"Jika kamu meminum obat setiap 30 menit sebanyak 3 kali, berapa waktu yang dibutuhkan sampai obat habis?", correct:"1 jam", options:["30 menit","1 jam","1.5 jam","2 jam"] },

{ question:"Jika 2 ayah dan 2 anak pergi memancing dan mereka hanya menangkap 3 ikan tetapi masing-masing mendapat 1 ikan, bagaimana bisa?", correct:"Ada kakek, ayah, dan anak", options:["Ada 4 orang","Ada kakek, ayah, dan anak","Ikan dibagi","Tidak mungkin"] },

{ question:"Jika semua guru adalah pekerja dan sebagian pekerja rajin, maka...", correct:"Guru mungkin rajin", options:["Semua guru rajin","Tidak ada guru rajin","Guru mungkin rajin","Semua pekerja guru"] },

{ question:"Jika 8 × 0 + 5 = ?", correct:"5", options:["0","5","8","40"] },

{ question:"Jika semua mobil punya roda dan sepeda punya roda, maka...", correct:"Tidak bisa disimpulkan sepeda mobil", options:["Sepeda mobil","Mobil sepeda","Tidak bisa disimpulkan sepeda mobil","Semua roda mobil"] },

{ question:"Jika kamu berada di posisi terakhir lomba dan menyalip satu orang, posisi kamu sekarang adalah...", correct:"Kedua dari belakang", options:["Terakhir","Pertama","Kedua dari belakang","Kedua"] },

{ question:"Jika 4 orang membutuhkan 4 hari untuk membangun tembok, maka 2 orang membutuhkan...", correct:"8 hari", options:["2 hari","4 hari","6 hari","8 hari"] },

{ question:"Jika semua mahasiswa belajar dan sebagian yang belajar rajin, maka...", correct:"Mahasiswa mungkin rajin", options:["Semua mahasiswa rajin","Tidak ada mahasiswa rajin","Mahasiswa mungkin rajin","Semua rajin mahasiswa"] },

{ question:"Jika hari ini Jumat, maka 7 hari lagi adalah hari...", correct:"Jumat", options:["Kamis","Jumat","Sabtu","Minggu"] },

{ question:"Jika harga 1 buku 10 ribu dan kamu membeli 5 buku lalu mendapat diskon 10 ribu, berapa yang harus dibayar?", correct:"40000", options:["30000","40000","45000","50000"] },

{ question:"Jika semua ikan hidup di air dan paus hidup di air, maka...", correct:"Tidak pasti paus ikan", options:["Paus ikan","Ikan paus","Tidak pasti paus ikan","Semua paus ikan"] },

{ question:"Jika 9 + 9 ÷ 3 = ?", correct:"12", options:["6","9","12","18"] },

{ question:"Jika kamu memiliki 20 apel dan memakan 5 apel, berapa apel yang kamu miliki?", correct:"15", options:["5","10","15","20"] },

{ question:"Jika semua buku adalah benda dan sebagian benda berat, maka...", correct:"Buku mungkin berat", options:["Semua buku berat","Tidak ada buku berat","Buku mungkin berat","Semua benda buku"] },

{ question:"Jika 100 ÷ 10 × 2 = ?", correct:"20", options:["5","10","20","40"] },

{ question:"Jika semua polisi adalah pegawai dan sebagian pegawai disiplin, maka...", correct:"Polisi mungkin disiplin", options:["Semua polisi disiplin","Tidak ada polisi disiplin","Polisi mungkin disiplin","Semua disiplin polisi"] },

{ question:"Jika sebuah mobil menempuh 60 km dalam 1 jam, berapa jarak dalam 30 menit?", correct:"30 km", options:["20 km","25 km","30 km","40 km"] },

{ question:"Jika 2 + 2 × 2 = ?", correct:"6", options:["4","6","8","12"] },

{ question:"Jika semua dokter bekerja di rumah sakit dan sebagian pekerja rumah sakit rajin, maka...", correct:"Dokter mungkin rajin", options:["Semua dokter rajin","Tidak ada dokter rajin","Dokter mungkin rajin","Semua rajin dokter"] },

{ question:"Jika kamu berjalan 3 km ke utara lalu 3 km ke selatan, kamu sekarang berada di...", correct:"Tempat awal", options:["Utara","Selatan","Tempat awal","Barat"] },

{ question:"Jika 6 × 6 ÷ 3 = ?", correct:"12", options:["6","12","18","36"] },

{ question:"Jika semua siswa belajar dan sebagian yang belajar pintar, maka...", correct:"Siswa mungkin pintar", options:["Semua siswa pintar","Tidak ada siswa pintar","Siswa mungkin pintar","Semua pintar siswa"] },

{ question:"Jika kamu punya uang 100 ribu dan membeli barang 75 ribu, berapa sisa uang?", correct:"25000", options:["20000","25000","30000","35000"] },

{ question:"Jika 10 + 10 × 0 = ?", correct:"10", options:["0","10","20","100"] },

{ question:"Jika semua kendaraan memiliki roda dan sepeda motor memiliki roda, maka...", correct:"Motor adalah kendaraan", options:["Motor bukan kendaraan","Motor kendaraan","Semua kendaraan motor","Tidak ada motor"] },

{ question:"Jika 7 + 3 × 2 = ?", correct:"13", options:["10","13","14","20"] },

{ question:"Jika semua burung bisa bertelur dan ayam adalah burung, maka...", correct:"Ayam bertelur", options:["Ayam tidak bertelur","Ayam bertelur","Semua telur ayam","Ayam bukan burung"] },

{ question:"Jika sebuah pekerjaan selesai dalam 10 hari oleh 5 orang, maka 1 orang akan menyelesaikan dalam...", correct:"50 hari", options:["10 hari","20 hari","40 hari","50 hari"] },

{ question:"Jika 8 + 2 × 5 = ?", correct:"18", options:["10","16","18","50"] }

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

/* ================= START SYSTEM ================= */

client.on("clientReady",()=>{

const guild = client.guilds.cache.get(process.env.GUILD_ID)

if(!guild) return

startCountdown(guild)

})