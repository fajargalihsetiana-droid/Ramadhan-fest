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

{question:"3² + 4² = ?",correct:"25",options:["7","12","25","49"]},
{question:"Planet terbesar?",correct:"Jupiter",options:["Mars","Jupiter","Saturnus","Neptunus"]},
{question:"Jumlah sudut segitiga?",correct:"180°",options:["90°","180°","270°","360°"]},
{question:"Akar dari 144?",correct:"12",options:["10","11","12","13"]},
{question:"Jika 2 + 2 × 2 = ?",correct:"6",options:["8","6","4","10"]}

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

if(interaction.isButton()){

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

console.log("BOT ONLINE - AUTO QUIZ TIAP JAM AKTIF");

const guild=client.guilds.cache.get(process.env.GUILD_ID);

if(guild){
startAutoQuizSystem(guild);
}

/* ================= COMMAND ================= */

const commands=[

new SlashCommandBuilder()
.setName("cooldown")
.setDescription("Cek cooldown"),

new SlashCommandBuilder()
.setName("soal")
.setDescription("Kirim quiz"),

new SlashCommandBuilder()
.setName("spawnboss")
.setDescription("Spawn boss ramadhan"),

new SlashCommandBuilder()
.setName("addpoin")
.setDescription("Tambah poin")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addIntegerOption(o=>o.setName("jumlah").setDescription("Jumlah").setRequired(true))

].map(c=>c.toJSON());

const rest=new REST({version:"10"}).setToken(process.env.TOKEN);

await rest.put(
Routes.applicationGuildCommands(client.user.id,process.env.GUILD_ID),
{body:commands}
);

console.log("✅ Slash command terdaftar");

});

client.login(process.env.TOKEN);

/* =====================================================
🐉 RAMADHAN BOSS RAID SYSTEM
===================================================== */

let boss=null
let bossMessage=null
let bossPlayers={}

const BOSS_MAX_HP=5000

/* ================= HP BAR ================= */

function bossHPBar(current,max){

const size=18
const percent=current/max

const filled=Math.round(size*percent)
const empty=size-filled

return "█".repeat(filled)+"░".repeat(empty)

}

/* ================= SPAWN BOSS ================= */

async function spawnBoss(guild){

if(boss) return

const channel=guild.channels.cache.get(process.env.BOSS_CHANNEL_ID)
if(!channel) return

bossPlayers={}

boss={
hp:BOSS_MAX_HP,
maxHp:BOSS_MAX_HP,
rage:false
}

const embed=new EmbedBuilder()

.setTitle("🐉 BOSS RAMADHAN MUNCUL!")

.setDescription(`
HP: **${boss.hp} / ${boss.maxHp}**

${bossHPBar(boss.hp,boss.maxHp)}

⚔️ Attack
🛡️ Defend
✨ Skill
`)

.setColor("Red")

.setImage("https://i.imgur.com/7nQqK5F.png")

const row=new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("boss_attack")
.setLabel("⚔️ Attack")
.setStyle(ButtonStyle.Danger),

new ButtonBuilder()
.setCustomId("boss_defend")
.setLabel("🛡️ Defend")
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId("boss_skill")
.setLabel("✨ Skill")
.setStyle(ButtonStyle.Primary)

)

bossMessage=await channel.send({

content:`<@&${process.env.GIVEAWAY_ROLE_ID}> 🐉 **BOSS RAMADHAN MUNCUL!**`,

embeds:[embed],
components:[row]

})

}

/* ================= UPDATE BOSS ================= */

async function updateBoss(){

if(!bossMessage) return

const sorted=Object.entries(bossPlayers)

.sort((a,b)=>b[1]-a[1])
.slice(0,5)

let leaderboard=""

sorted.forEach((p,i)=>{
leaderboard+=`${i+1}. <@${p[0]}> — ${p[1]} dmg\n`
})

if(!leaderboard) leaderboard="Belum ada serangan"

let rageText=""

if(boss.rage) rageText="🔥 **RAGE MODE AKTIF!**\n"

const embed=new EmbedBuilder()

.setTitle("🐉 RAMADHAN BOSS RAID")

.setDescription(`
HP: **${boss.hp} / ${boss.maxHp}**

${bossHPBar(boss.hp,boss.maxHp)}

${rageText}

🏆 Top Damage

${leaderboard}

⚔️ Attack
🛡️ Defend
✨ Skill
`)

.setColor("Red")

.setImage("https://i.imgur.com/7nQqK5F.png")

await bossMessage.edit({embeds:[embed]})

}

/* ================= BOSS DEAD ================= */

async function bossDead(guild){

const channel=guild.channels.cache.get(process.env.BOSS_CHANNEL_ID)

const sorted=Object.entries(bossPlayers)

.sort((a,b)=>b[1]-a[1])

let result="🎉 **BOSS RAMADHAN DIKALAHKAN!**\n\n"

sorted.slice(0,5).forEach((p,i)=>{
result+=`${i+1}. <@${p[0]}> — ${p[1]} damage\n`
})

channel.send(result)

/* reward */

sorted.forEach((p,i)=>{

const user=getUser(p[0])

if(i===0) user.points+=120
else if(i===1) user.points+=80
else if(i===2) user.points+=60
else user.points+=30

})

saveData()

boss=null
bossMessage=null
bossPlayers={}

}

/* ================= DAMAGE ================= */

function calculateDamage(type){

let dmg=0

if(type==="attack") dmg=Math.floor(Math.random()*40)+40

if(type==="skill") dmg=Math.floor(Math.random()*80)+120

/* critical */

if(Math.random()<0.1){
dmg*=2
}

if(boss.rage){
dmg=Math.floor(dmg*1.2)
}

return dmg

}

/* ================= BUTTON ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return
if(!boss) return

/* ATTACK */

if(interaction.customId==="boss_attack"){

let dmg=calculateDamage("attack")

boss.hp-=dmg

if(!bossPlayers[interaction.user.id])
bossPlayers[interaction.user.id]=0

bossPlayers[interaction.user.id]+=dmg

}

/* SKILL */

if(interaction.customId==="boss_skill"){

let dmg=calculateDamage("skill")

boss.hp-=dmg

if(!bossPlayers[interaction.user.id])
bossPlayers[interaction.user.id]=0

bossPlayers[interaction.user.id]+=dmg

}

/* DEFEND */

if(interaction.customId==="boss_defend"){

return interaction.reply({
content:"🛡️ Defense aktif!",
ephemeral:true
})

}

/* rage */

if(boss.hp<=boss.maxHp/2 && !boss.rage){

boss.rage=true

const channel=interaction.guild.channels.cache.get(process.env.BOSS_CHANNEL_ID)

channel.send("🔥 **BOSS MASUK RAGE MODE!**")

}

if(boss.hp<=0){

boss.hp=0

await updateBoss()

await bossDead(interaction.guild)

return interaction.reply({
content:"⚔️ Boss dikalahkan!",
ephemeral:true
})

}

await updateBoss()

return interaction.reply({
content:"⚔️ Serangan berhasil!",
ephemeral:true
})

})

/* ================= SPAWN SCHEDULE ================= */

function startBossSchedule(client){

setInterval(()=>{

const now=new Date()

const hour=now.getHours()

if(hour===15||hour===18||hour===21){

client.guilds.cache.forEach(guild=>{
spawnBoss(guild)
})

}

},60000)

}

/* ================= MANUAL SPAWN ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return

if(interaction.commandName==="spawnboss"){

if(interaction.user.id!==OWNER_ID)
return interaction.reply({
content:"❌ Hanya owner.",
ephemeral:true
})

await spawnBoss(interaction.guild)

return interaction.reply({
content:"🐉 Boss berhasil di spawn!",
ephemeral:true
})

}

})

client.once("clientReady",()=>{
startBossSchedule(client)
})