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

client.on("messageCreate", async message => {

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

let reward = Math.floor(Math.random()*10) + 10

user.points += reward
user.keywordCooldowns[content] = now + keywordCooldown[content]

saveData()

/* ===== RANK CALCULATION ===== */

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

const rank = sorted.findIndex(e=>e[0]===message.author.id) + 1

const topPoints = sorted[0][1].points

const gap = topPoints - user.points

let gapText = ""

if(rank === 1){

gapText = "👑 Kamu sedang memimpin leaderboard!"

}else{

gapText = `📉 ${gap} poin lagi untuk mengejar rank #1`

}

/* ===== EMBED ===== */

const embed = new EmbedBuilder()

.setColor("Gold")

.setDescription(
`✨ **+${reward} poin**

🏆 **Total: ${user.points} poin**
📊 **Rank: #${rank}**

${gapText}`
)

.setFooter({
text: message.author.username,
iconURL: message.author.displayAvatarURL({dynamic:true})
})

message.channel.send({embeds:[embed]})

await updateLeaderboard(message.guild)

})

/* ================= SHUFFLE ================= */

function shuffle(array){

for(let i=array.length-1;i>0;i--){

const j=Math.floor(Math.random()*(i+1));

[array[i],array[j]]=[array[j],array[i]];

}

return array;

}

/* ================= QUIZ ================= */

let activeQuiz=null;
const questions=[

{ question:"Jika ada 3 apel dan kamu mengambil 2 apel, berapa apel yang kamu miliki?", correct:"2", options:["1","2","3","Tidak ada"] },

{ question:"Seekor ayam memiliki 2 kaki. Jika ada 5 ayam, berapa total kaki ayam?", correct:"10", options:["8","10","12","15"] },

{ question:"Jika hari ini hari Senin, dua hari setelah besok adalah hari apa?", correct:"Kamis", options:["Rabu","Kamis","Jumat","Selasa"] },

{ question:"Sebuah mobil memiliki 4 roda. Jika ada 3 mobil, berapa total roda?", correct:"12", options:["8","10","12","16"] },

{ question:"Jika 1 orang makan 1 roti dalam 1 menit, berapa roti yang dimakan 5 orang dalam 1 menit?", correct:"5", options:["1","3","5","10"] },

{ question:"Jika kamu punya 10 permen lalu memberi 4 kepada teman, berapa sisa permenmu?", correct:"6", options:["4","5","6","7"] },

{ question:"Jika sebuah jam menunjukkan pukul 03:00, berapa jam lagi menuju pukul 06:00?", correct:"3", options:["2","3","4","5"] },

{ question:"Ada 4 burung di pohon. 1 burung terbang pergi. Berapa burung yang tersisa di pohon?", correct:"3", options:["2","3","4","1"] },

{ question:"Jika kamu berlari lomba dan menyalip orang di posisi ke-2, kamu sekarang berada di posisi berapa?", correct:"2", options:["1","2","3","4"] },

{ question:"Jika ada 10 ikan di akuarium dan 2 mati, berapa ikan yang masih ada di akuarium?", correct:"10", options:["8","10","2","0"] },

{ question:"Jika sebuah segitiga memiliki 3 sisi, berapa sisi yang dimiliki 2 segitiga?", correct:"6", options:["4","5","6","8"] },

{ question:"Jika satu minggu ada 7 hari, berapa hari dalam 2 minggu?", correct:"14", options:["12","13","14","15"] },

{ question:"Jika kamu memiliki 5 pensil dan membeli 5 lagi, berapa total pensilmu?", correct:"10", options:["8","9","10","11"] },

{ question:"Jika ada 3 kotak dan setiap kotak berisi 2 bola, berapa total bola?", correct:"6", options:["3","4","5","6"] },

{ question:"Jika kamu memotong kue menjadi 4 bagian lalu mengambil 1 bagian, berapa bagian yang tersisa?", correct:"3", options:["1","2","3","4"] }

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

let reward = 50

if(i===0) reward=300
else if(i===1) reward=200
else if(i===2) reward=100

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
🎁 HADIAH RAMADHAN (VERSI KETIK AMBIL)
===================================================== */

let hadiahActive = null
let hadiahTimeout = null

/* ================= RANDOM TEXT ================= */

const hadiahQuotes = [
"🎁 Dapet poin nih kamu <@USER>, yakin ga mau ambil?",
"👀 <@USER> ada hadiah turun dari langit!",
"🔥 <@USER> kamu kepilih sistem! Ketik **ambil**!",
"💰 Lucky moment! <@USER> dapet hadiah!",
"😏 <@USER> berani ambil hadiahnya ga?",
"⚡ Hadiah misterius muncul untuk <@USER>!"
]

const trollQuotes = [
"🤡 Oops <@USER>... ternyata kosong 😆",
"🪤 <@USER> kena prank sistem!",
"💨 Hadiahnya kabur duluan!",
"🧻 Cuma dapet tisu... coba lagi nanti!",
"🐟 Sistem: 'kamu hampir dapat hadiah' 🤣"
]

/* ================= SHUFFLE ================= */

function shuffleUsers(arr){
return arr.sort(()=>Math.random()-0.5)
}

/* ================= RANK ================= */

function getRank(userId){

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

return sorted.findIndex(e=>e[0]===userId)+1

}

/* ================= REWARD ================= */

function getReward(rank){

if(Math.random()<0.05) return 500

if(rank===1) return Math.floor(Math.random()*20)+20
if(rank===2) return Math.floor(Math.random()*30)+40
if(rank===3) return Math.floor(Math.random()*40)+70
if(rank<=5) return Math.floor(Math.random()*60)+100
if(rank<=10) return Math.floor(Math.random()*90)+150

return Math.floor(Math.random()*150)+220

}

/* ================= SPAWN HADIAH ================= */

async function spawnHadiah(guild,target){

if(hadiahActive) return

const channel = guild.channels.cache.get(process.env.HADIAH_CHANNEL_ID)
if(!channel) return

const isTroll = Math.random()<0.15

const list = isTroll ? trollQuotes : hadiahQuotes

const member = await guild.members.fetch(target)

const quote = list[
Math.floor(Math.random()*list.length)
].replace("<@USER>", `@${member}`)

hadiahActive={
user:target,
troll:isTroll
}

const embed = new EmbedBuilder()
.setColor("Gold")
.setTitle("🎁 HADIAH RAMADHAN")
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`
${quote}

━━━━━━━━━━━━━━━━━━

⏳ **90 detik**

👉 ${member.displayName} ketik **ambil**
`)
.setFooter({text:"Ramadhan Fest Event"})
.setTimestamp()

await channel.send({embeds:[embed]})

/* timer hangus */

hadiahTimeout=setTimeout(async()=>{

if(!hadiahActive) return

const embed = new EmbedBuilder()
.setColor("Red")
.setTitle("⏳ HADIAH HANGUS")
.setDescription(`
Hadiah untuk <@${hadiahActive.user}> tidak diambil.

💨 Hadiah menghilang...
`)
.setTimestamp()

await channel.send({embeds:[embed]})

hadiahActive=null

},90000)

}

/* ================= CLAIM HADIAH ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return
if(message.channel.id !== process.env.HADIAH_CHANNEL_ID) return

if(message.content.toLowerCase()!=="ambil") return
if(!hadiahActive) return

if(message.author.id !== hadiahActive.user){

return message.reply("❌ Hadiah ini bukan untuk kamu.")
}

clearTimeout(hadiahTimeout)

/* troll hadiah */

if(hadiahActive.troll){

await message.reply(
`🤡 **PRANK!**

<@${message.author.id}> cuma dapet angin 😆`
)

hadiahActive=null
return

}

/* hadiah normal */

const rank=getRank(message.author.id)
let reward=getReward(rank)

reward=applyRankBalance(message.author.id,reward)
reward=applyGapBalance(message.author.id,reward)

const user=getUser(message.author.id)

user.points+=reward

await logPoint(message.guild,message.author.id,reward,"Hadiah Ramadhan")

saveData()
await updateLeaderboard(message.guild)

const member = await message.guild.members.fetch(message.author.id)

const embed = new EmbedBuilder()
.setColor("Green")
.setTitle("🎉 HADIAH DIAMBIL!")
.setThumbnail(member.user.displayAvatarURL({dynamic:true}))
.setDescription(`
👤 ${member}

💰 **+${reward} poin**
`)
.setFooter({text:"Selamat!"})
.setTimestamp()

await message.reply({embeds:[embed]})

hadiahActive=null

})

/* ================= AUTO SPAWN ================= */

function startHadiahSchedule(guild){

let lastSpawnHour=null

setInterval(async()=>{

const now=new Date()

let hour=now.getUTCHours()+7
const minute=now.getUTCMinutes()

if(hour>=24) hour-=24

if(hour<6||hour>22) return
if(minute> 3) return
if(lastSpawnHour===hour) return

lastSpawnHour=hour

const members=await guild.members.fetch()

const users=members
.filter(m=>!m.user.bot)
.map(m=>m.id)

const shuffled=shuffleUsers(users)

const targets=shuffled.slice(0,10)

for(const user of targets){

await spawnHadiah(guild,user)

/* tunggu selesai */

while(hadiahActive){
await new Promise(r=>setTimeout(r,1000))
}

}

const channel=guild.channels.cache.get(process.env.HADIAH_CHANNEL_ID)

if(channel){

channel.send(
`🤖 udah ya.. bot capek nyebutin satu²  
lanjut jam berikutnya.. bye 👋`
)

}

},60000)

}

/* ================= MANUAL COMMAND ================= */

client.on("messageCreate",async message=>{

if(message.author.bot) return

if(message.content==="!hadiah"){

if(message.author.id!==OWNER_ID){
return message.reply("❌ Owner only.")
}

const guild=message.guild

const members=await guild.members.fetch()

const users=members
.filter(m=>!m.user.bot)
.map(m=>m.id)

const shuffled=shuffleUsers(users)

const targets=shuffled.slice(0,10)

for(const user of targets){

await spawnHadiah(guild,user)

while(hadiahActive){
await new Promise(r=>setTimeout(r,1000))
}

}

message.reply("🎁 10 hadiah berhasil di spawn!")

}

})

/* ================= START ================= */

client.once("clientReady",async()=>{

const guild=client.guilds.cache.get(process.env.GUILD_ID)
if(!guild) return

startHadiahSchedule(guild)

})


