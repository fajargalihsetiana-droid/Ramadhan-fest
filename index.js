require("dotenv").config();
const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
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

/* ================= SHUFFLE ================= */

function shuffle(array){

for(let i=array.length-1;i>0;i--){

const j=Math.floor(Math.random()*(i+1));

[array[i],array[j]]=[array[j],array[i]];

}

return array;

}

/* ================= GAP BALANCE ================= */

function applyGapBalance(userId, baseReward){

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

if(!data[userId]) return baseReward
if(sorted.length===0) return baseReward

const rankIndex = sorted.findIndex(e=>e[0]===userId)

const topPoints = sorted[0][1].points
const userPoints = data[userId].points

const gap = topPoints - userPoints

let multiplier = 1

if(rankIndex === 0) multiplier *= 0.9
else if(rankIndex === 1) multiplier *= 1
else if(rankIndex === 2) multiplier *= 1.3
else multiplier *= 1.5

if(gap > 2000) multiplier *= 1.4
else if(gap > 1000) multiplier *= 1.2
else if(gap < 200) multiplier *= 0.9

let reward = Math.floor(baseReward * multiplier)

if(reward < 50) reward = 50

return reward

}

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
const second=sorted[1]||null;

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

/* BASE REWARD */

let reward = Math.floor(Math.random()*40) + 90

reward = applyGapBalance(message.author.id,reward)

/* JACKPOT */

if(Math.random() < 0.02){

reward += 500

message.channel.send(`
🎉 **JACKPOT FARM!**
<@${message.author.id}> mendapatkan **+500 poin bonus!**
`)

}

user.points += reward
user.keywordCooldowns[content] = now + keywordCooldown[content]

saveData()

await logPoint(message.guild,message.author.id,reward,"Farm")

const embed=new EmbedBuilder()
.setColor("Gold")
.setDescription(
`✨ **+${reward} poin**

🏆 **Total: ${user.points} poin**`
)

message.channel.send({embeds:[embed]})

await updateLeaderboard(message.guild)

})

/* ================= QUIZ ================= */

let activeQuiz=null
const questions=[
{question:"2+2=?",correct:"4",options:["3","4","5","6"]},
{question:"5+5=?",correct:"10",options:["8","9","10","11"]}
]

async function sendQuiz(guild){

if(activeQuiz) return

const channel=guild.channels.cache.get(process.env.QUIZ_CHANNEL_ID)
if(!channel) return

const q=questions[Math.floor(Math.random()*questions.length)]
const shuffled=shuffle([...q.options])
const correctIndex=shuffled.indexOf(q.correct)

const embed=new EmbedBuilder()
.setTitle("🧠 QUIZ RAMADHAN")
.setDescription(`
❓ ${q.question}

🇦 ${shuffled[0]}
🇧 ${shuffled[1]}
🇨 ${shuffled[2]}
🇩 ${shuffled[3]}
`)
.setColor("Gold")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder().setCustomId("0").setLabel("A").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("1").setLabel("B").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("2").setLabel("C").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("3").setLabel("D").setStyle(ButtonStyle.Primary)

)

const msg=await channel.send({
embeds:[embed],
components:[row]
})

activeQuiz={
correct:correctIndex,
answered:[]
}

setTimeout(async()=>{

if(!activeQuiz) return

await msg.edit({components:[]})

activeQuiz=null

},45*60*1000)

}

/* ================= BOSS RAID ================= */

let raidBoss=null
let raidMessage=null
let raidPlayers={}
let attackCooldown={}

const RAID_HP=4000

function raidHPBar(current,max){

const size=20
const percent=current/max

const filled=Math.round(size*percent)
const empty=size-filled

return "🟥".repeat(filled)+"⬛".repeat(empty)

}

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
HP: ${raidBoss.hp}/${raidBoss.max}

${raidHPBar(raidBoss.hp,raidBoss.max)}
`)
.setColor("Red")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("raid_attack")
.setLabel("⚔️ Attack")
.setStyle(ButtonStyle.Danger)

)

raidMessage=await channel.send({

embeds:[embed],
components:[row]

})

}

/* ================= READY ================= */

client.once("clientReady",async()=>{

console.log("BOT ONLINE")

const guild = client.guilds.cache.get(process.env.GUILD_ID)

if(!guild) return

setInterval(()=>{

const now = new Date()

let hour = now.getUTCHours()+7
const minute = now.getUTCMinutes()

if(hour>=24) hour-=24

if(minute!==0) return

if([9,15,21].includes(hour)){

spawnRaid(guild)

}

},60000)

})

client.login(process.env.TOKEN)