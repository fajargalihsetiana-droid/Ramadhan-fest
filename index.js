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

{ question:"Dalam sebuah lomba, empat peserta bernama Ali, Budi, Chandra, dan Dani berdiri berjajar. Ali tidak berada di posisi paling depan maupun paling belakang. Budi berdiri tepat di belakang Chandra. Dani berada di posisi paling depan. Siapakah yang berada di posisi paling belakang?", correct:"Budi", options:["Ali","Budi","Chandra","Dani"] },

{ question:"Di sebuah ruangan terdapat empat kotak: merah, biru, hijau, dan kuning. Hanya satu kotak yang berisi hadiah. Kotak merah berkata 'Hadiah ada di kotak biru'. Kotak biru berkata 'Hadiah tidak ada di sini'. Kotak hijau berkata 'Kotak merah berbohong'. Kotak kuning berkata 'Hadiah ada di kotak hijau'. Jika hanya satu pernyataan yang benar, di kotak mana hadiah berada?", correct:"Hijau", options:["Merah","Biru","Hijau","Kuning"] },

{ question:"Empat teman duduk melingkar: Rina, Sinta, Tono, dan Dika. Rina tidak duduk di sebelah Sinta. Tono duduk di antara Rina dan Dika. Siapakah yang duduk di sebelah Sinta?", correct:"Dika", options:["Rina","Tono","Dika","Tidak bisa ditentukan"] },

{ question:"Seorang penjaga mengatakan bahwa hanya satu dari tiga orang berikut yang mengatakan kebenaran. Ali berkata: 'Budi berbohong'. Budi berkata: 'Chandra berbohong'. Chandra berkata: 'Ali dan Budi sama-sama berbohong'. Siapakah yang berkata benar?", correct:"Budi", options:["Ali","Budi","Chandra","Tidak ada"] },

{ question:"Di sebuah desa ada tiga rumah berwarna merah, biru, dan hijau. Andi tidak tinggal di rumah merah. Budi tidak tinggal di rumah biru. Chandra tinggal di sebelah rumah biru. Siapakah yang tinggal di rumah hijau?", correct:"Budi", options:["Andi","Budi","Chandra","Tidak bisa ditentukan"] },

{ question:"Empat siswa mengikuti lomba cerdas cermat: Dina, Fajar, Gita, dan Hadi. Dina mendapat nilai lebih tinggi dari Fajar. Gita mendapat nilai lebih rendah dari Hadi tetapi lebih tinggi dari Fajar. Siapakah yang kemungkinan mendapat nilai tertinggi?", correct:"Hadi", options:["Dina","Fajar","Gita","Hadi"] },

{ question:"Dalam sebuah antrean terdapat lima orang. Rudi berdiri di depan Seno tetapi di belakang Tika. Budi berdiri paling belakang. Jika Tika bukan yang paling depan, siapakah yang paling depan?", correct:"Rudi", options:["Rudi","Seno","Tika","Budi"] },

{ question:"Empat orang memiliki profesi berbeda: dokter, guru, koki, dan pilot. Ali bukan dokter. Budi bukan guru. Chandra bukan pilot dan bukan koki. Jika Dani adalah dokter, siapakah pilotnya?", correct:"Ali", options:["Ali","Budi","Chandra","Dani"] },

{ question:"Empat teman membawa tas berbeda warna: hitam, putih, merah, dan biru. Tas hitam bukan milik Andi. Tas merah milik orang yang duduk di sebelah Budi. Chandra tidak membawa tas biru. Jika Budi membawa tas putih, siapa yang membawa tas merah?", correct:"Andi", options:["Andi","Budi","Chandra","Dani"] },

{ question:"Seorang guru berkata kepada muridnya: 'Jika kamu mengatakan kebenaran, kamu akan dihukum. Jika kamu berbohong, kamu juga akan dihukum.' Murid itu kemudian mengatakan sesuatu yang membuat guru tidak bisa menghukumnya. Apa yang kemungkinan ia katakan?", correct:"Saya akan dihukum", options:["Saya akan dihukum","Saya berkata jujur","Saya berbohong","Saya tidak tahu"] }

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

if(minute !== 0) return

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

const user = getUser(p[0])

let reward=50

if(i===0) reward=300
else if(i===1) reward=200
else if(i===2) reward=100

user.points+=reward

await logPoint(
guild,
p[0],
reward,
"Boss Raid Reward"
)

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

let lastSpawn = null

setInterval(()=>{

const now = new Date()

let hour = now.getUTCHours()+7
const minute = now.getUTCMinutes()

if(hour>=24) hour-=24

if(minute !== 1) return

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
🎁 HADIAH RAMADHAN FINAL FULL SYSTEM
===================================================== */

let hadiahActive = null
let hadiahMessage = null

/* ================= RANDOM TEXT ================= */

const hadiahQuotes = [
"🎁 Dapet poin nih kamu <@USER>, yakin ga mau ambil?",
"👀 <@USER> ada hadiah turun dari langit!",
"🔥 <@USER> kamu kepilih sistem! Buruan claim!",
"💰 Lucky moment! <@USER> dapet hadiah!",
"😏 <@USER> berani claim hadiahnya ga?",
"⚡ Hadiah misterius muncul untuk <@USER>!"
]

const trollQuotes = [
"🤡 Oops <@USER>... ternyata kosong 😆",
"🪤 <@USER> kena prank sistem!",
"💨 Hadiahnya kabur duluan!",
"🧻 Cuma dapet tisu... coba lagi nanti!",
"🐟 Sistem: 'kamu hampir dapat hadiah' 🤣"
]

/* ================= PROGRESS BAR ================= */

function hadiahBar(percent){

const size = 20
const filled = Math.round(size * percent)
const empty = size - filled

return "🟩".repeat(filled)+"⬛".repeat(empty)

}

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

const quote = list[
Math.floor(Math.random() * list.length)
].replace("<@USER>",`<@${target}>`)

hadiahActive = {
user:target,
expire:Date.now()+90000,
troll:isTroll
}

const embed = new EmbedBuilder()

.setTitle("🎁 HADIAH RAMADHAN")

.setDescription(`
${quote}

━━━━━━━━━━━━━━━━━━

⏳ **90 detik**

${hadiahBar(1)}

Klik tombol **CLAIM**
`)

.setColor(isTroll ? "Grey" : "Gold")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("claim_hadiah")
.setLabel("🎁 CLAIM")
.setStyle(ButtonStyle.Success)

)

hadiahMessage = await channel.send({
content:`<@${target}>`,
embeds:[embed],
components:[row]
})

hadiahTimer(embed,quote)

/* ================= TIMER ================= */

async function hadiahTimer(embed,quote){

if(!hadiahActive) return

const remain = hadiahActive.expire - Date.now()

if(remain<=0){

await hadiahMessage.edit({
content:`⏳ Hadiah untuk <@${hadiahActive.user}> hangus...`,
components:[]
})

hadiahActive=null

return

}

const percent = remain/90000

const newEmbed = EmbedBuilder.from(embed)

.setDescription(`
${quote}

━━━━━━━━━━━━━━━━━━

⏳ **${Math.ceil(remain/1000)} detik**

${hadiahBar(percent)}

Klik tombol **CLAIM**
`)

await hadiahMessage.edit({embeds:[newEmbed]})

setTimeout(()=>{
hadiahTimer(embed,quote)
},5vv000)

}

}

/* ================= CLAIM ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return
if(interaction.customId!=="claim_hadiah") return
if(!hadiahActive) return

if(interaction.user.id!==hadiahActive.user){

return interaction.reply({
content:"❌ Hadiah ini bukan untuk kamu.",
ephemeral:true
})

}

/* troll hadiah */

if(hadiahActive.troll){

await interaction.update({
content:`🤡 **PRANK!**

<@${interaction.user.id}> cuma dapet angin 😆`,
embeds:[],
components:[]
})

hadiahActive=null
return
}

/* hadiah normal */

const rank = getRank(interaction.user.id)
let reward = getReward(rank)

reward = applyRankBalance(interaction.user.id,reward)
reward = applyGapBalance(interaction.user.id,reward)

const user = getUser(interaction.user.id)

user.points += reward

await logPoint(interaction.guild,interaction.user.id,reward,"Hadiah Ramadhan")

saveData()
await updateLeaderboard(interaction.guild)

await interaction.update({
content:`🎉 **HADIAH DIAMBIL!**

👤 <@${interaction.user.id}>
💰 +${reward} poin`,
embeds:[],
components:[]
})

hadiahActive=null

})

/* ================= AUTO SPAWN ================= */

function startHadiahSchedule(guild){

let lastSpawnHour = null

setInterval(async () => {

const now = new Date()

let hour = now.getUTCHours() + 7
const minute = now.getUTCMinutes()

if(hour >= 24) hour -= 24

if(hour < 6 || hour > 22) return
if(minute !== 2) return
if(lastSpawnHour === hour) return

lastSpawnHour = hour

const members = await guild.members.fetch()

const users = members
.filter(m => !m.user.bot)
.map(m => m.id)

const shuffled = shuffleUsers(users)

const targets = shuffled.slice(0,10)

for(const user of targets){

await spawnHadiah(guild,user)

/* tunggu hadiah selesai (claim / expire) */
while(hadiahActive){
await new Promise(r => setTimeout(r,1000))
}

}

const channel = guild.channels.cache.get(process.env.HADIAH_CHANNEL_ID)

if(channel){

channel.send(
`🤖 udah ya.. bot capek nyebutin satu²  
lanjut jam berikutnya.. bye 👋`
)

}

}, 60000)

}

/* ================= MANUAL SPAWN COMMAND ================= */

client.on("messageCreate", async message => {

if(message.author.bot) return

if(message.content === "!hadiah"){

if(message.author.id !== OWNER_ID){
return message.reply("❌ Owner only.")
}

const guild = message.guild

const members = await guild.members.fetch()

const users = members
.filter(m => !m.user.bot)
.map(m => m.id)

const shuffled = shuffleUsers(users)

const targets = shuffled.slice(0,10)

for(const user of targets){

while(hadiahActive){
await new Promise(r => setTimeout(r,2000))
}

await spawnHadiah(guild,user)

}

message.reply("🎁 10 hadiah berhasil di spawn!")

}

})

/* ================= START ================= */

client.once("clientReady", async () => {

const guild = client.guilds.cache.get(process.env.GUILD_ID)
if(!guild) return

startHadiahSchedule(guild)

})
