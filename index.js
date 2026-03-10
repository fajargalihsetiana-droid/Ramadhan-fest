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

if(rankIndex === 0) multiplier *= 0.9
else if(rankIndex === 1) multiplier *= 1
else if(rankIndex === 2) multiplier *= 1.3
else multiplier *= 1.5

/* ===== GAP BALANCE ===== */

if(gap > 2000) multiplier *= 1.4
else if(gap > 1000) multiplier *= 1.2
else if(gap < 200) multiplier *= 0.9

let reward = Math.floor(baseReward * multiplier)

/* ===== JACKPOT ===== */

if(Math.random() < 0.03){

reward += 500

}

return reward

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

let reward = Math.floor(Math.random()*50) + 80

reward = applyGapBalance(message.author.id, reward)

if(Math.random() < 0.02){

reward += 500

message.channel.send(`
🎉 **JACKPOT FARM!**
<@${message.author.id}> mendapatkan **+500 poin bonus!**
`)

}

user.points += reward

user.keywordCooldowns[content] = now + keywordCooldown[content]
message.channel.send(`
🎉 **JACKPOT FARM!**

saveData()

await logPoint(
message.guild,
message.author.id,
reward,
"Farm"
)
  
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

{ question:"Siapa yang memiliki cashback tertinggi di leaderboard?", correct:"Hidupp_Jokow111111", options:["Hidupp_Jokow111111","5_atapu","Aca_giofano2","SkylarkGw"] },

{ question:"Siapa yang berada di posisi kedua leaderboard cashback?", correct:"5_atapu", options:["5_atapu","SkylarkGw","Aca_giofano2","mgmi_wifssrawrr"] },

{ question:"Siapa yang berada tepat di bawah 5_atapu?", correct:"Aca_giofano2", options:["Aca_giofano2","SkylarkGw","mgmi_wifssrawrr","SierraG60"] },

{ question:"Berapa cashback yang dimiliki SkylarkGw?", correct:"470", options:["470","450","480","420"] },

{ question:"Siapa pemain dengan cashback 822?", correct:"5_atapu", options:["5_atapu","Aca_giofano2","SkylarkGw","mgmi_wifssrawrr"] },

{ question:"Siapa pemain dengan cashback 643?", correct:"Aca_giofano2", options:["Aca_giofano2","SkylarkGw","pinxinss","nantacomel"] },

{ question:"Siapa pemain dengan cashback 257?", correct:"mgmi_wifssrawrr", options:["mgmi_wifssrawrr","SierraG60","pinxinss","nantacomel"] },

{ question:"Siapa pemain dengan cashback 222?", correct:"SierraG60", options:["SierraG60","pinxinss","nantacomel","bebe_lack10"] },

{ question:"Berapa cashback milik pinxinss?", correct:"192", options:["192","182","202","212"] },

{ question:"Siapa yang memiliki cashback 171?", correct:"nantacomel", options:["nantacomel","bebe_lack10","SkylarkGw","SierraG60"] },

{ question:"Siapa yang memiliki cashback 160?", correct:"bebe_lack10", options:["bebe_lack10","shkayaa","ansello370","SkylarkGw"] },

{ question:"Siapa yang memiliki cashback 156?", correct:"shkayaa", options:["shkayaa","ansello370","SierraG60","pinxinss"] },

{ question:"Siapa yang memiliki cashback 146?", correct:"ansello370", options:["ansello370","SierraG60","SkylarkGw","pinxinss"] },

{ question:"Siapa yang memiliki cashback 116?", correct:"Slebeww2663", options:["Slebeww2663","sanitati8308","tatpungz","Moonshineus"] },

{ question:"Siapa yang memiliki cashback 88?", correct:"sanitati8308", options:["sanitati8308","tatpungz","Moonshineus","Macaaaaa123"] },

{ question:"Siapa yang memiliki cashback 81?", correct:"tatpungz", options:["tatpungz","Moonshineus","Macaaaaa123","Wildstorm01246"] },

{ question:"Siapa yang memiliki cashback 51?", correct:"Moonshineus", options:["Moonshineus","Macaaaaa123","Wildstorm01246","colmintzx"] },

{ question:"Siapa yang memiliki cashback 49?", correct:"Macaaaaa123", options:["Macaaaaa123","Wildstorm01246","colmintzx","TheRosebud2014"] },

{ question:"Siapa yang memiliki cashback 43?", correct:"Wildstorm01246", options:["Wildstorm01246","Moonshineus","Macaaaaa123","colmintzx"] },

{ question:"Berapa total cashback yang terlihat di bagian bawah leaderboard?", correct:"4.991", options:["4.991","4.500","5.100","3.980"] },

{ question:"Siapa yang memiliki rank Elite di leaderboard?", correct:"Hidupp_Jokow111111", options:["Hidupp_Jokow111111","SkylarkGw","mgmi_wifssrawrr","pinxinss"] },

{ question:"Siapa yang memiliki rank Investor selain SkylarkGw?", correct:"Aca_giofano2", options:["Aca_giofano2","pinxinss","nantacomel","bebe_lack10"] },

{ question:"Siapa pemain dengan rank Grinder?", correct:"mgmi_wifssrawrr", options:["mgmi_wifssrawrr","SkylarkGw","Aca_giofano2","pinxinss"] },

{ question:"Siapa pemain yang memiliki cashback lebih dari 800?", correct:"5_atapu", options:["5_atapu","Aca_giofano2","SkylarkGw","mgmi_wifssrawrr"] },

{ question:"Siapa pemain yang memiliki cashback lebih dari 600?", correct:"Aca_giofano2", options:["Aca_giofano2","SkylarkGw","mgmi_wifssrawrr","pinxinss"] },

{ question:"Siapa pemain dengan cashback di atas 1000?", correct:"Hidupp_Jokow111111", options:["Hidupp_Jokow111111","5_atapu","Aca_giofano2","SkylarkGw"] },

{ question:"Siapa pemain yang memiliki cashback di bawah 50?", correct:"Wildstorm01246", options:["Wildstorm01246","Moonshineus","Macaaaaa123","sanitati8308"] },

{ question:"Siapa pemain yang berada tepat di atas pinxinss?", correct:"SierraG60", options:["SierraG60","nantacomel","bebe_lack10","SkylarkGw"] },

{ question:"Siapa pemain yang berada tepat di bawah SierraG60?", correct:"pinxinss", options:["pinxinss","nantacomel","bebe_lack10","shkayaa"] },

{ question:"Siapa pemain dengan cashback sekitar 170?", correct:"nantacomel", options:["nantacomel","pinxinss","bebe_lack10","shkayaa"] },

{ question:"Siapa pemain dengan cashback sekitar 150?", correct:"shkayaa", options:["shkayaa","ansello370","bebe_lack10","SierraG60"] },

{ question:"Siapa pemain dengan cashback sekitar 140?", correct:"ansello370", options:["ansello370","SierraG60","pinxinss","nantacomel"] },

{ question:"Siapa pemain dengan cashback sekitar 110?", correct:"Slebeww2663", options:["Slebeww2663","sanitati8308","tatpungz","Moonshineus"] },

{ question:"Siapa pemain dengan cashback sekitar 80?", correct:"tatpungz", options:["tatpungz","Moonshineus","Macaaaaa123","Wildstorm01246"] },

{ question:"Siapa pemain dengan cashback sekitar 50?", correct:"Moonshineus", options:["Moonshineus","Macaaaaa123","Wildstorm01246","colmintzx"] },

{ question:"Siapa pemain yang memiliki cashback paling kecil di daftar?", correct:"Wildstorm01246", options:["Wildstorm01246","Moonshineus","Macaaaaa123","tatpungz"] },

{ question:"Siapa pemain dengan rank Hunter?", correct:"pinxinss", options:["pinxinss","SkylarkGw","Aca_giofano2","Hidupp_Jokow111111"] },

{ question:"Siapa pemain yang berada di posisi ke-4 leaderboard?", correct:"SkylarkGw", options:["SkylarkGw","Aca_giofano2","mgmi_wifssrawrr","pinxinss"] },

{ question:"Siapa pemain yang memiliki cashback lebih dari 200 tapi kurang dari 300?", correct:"mgmi_wifssrawrr", options:["mgmi_wifssrawrr","SierraG60","pinxinss","nantacomel"] },

{ question:"Siapa pemain yang memiliki cashback lebih dari 400 tapi kurang dari 500?", correct:"SkylarkGw", options:["SkylarkGw","Aca_giofano2","5_atapu","mgmi_wifssrawrr"] }

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

try{

if(!activeQuiz){
console.log("Quiz expired but already cleared")
return
}

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

let reward=Math.floor(Math.random()*80)+120;

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
