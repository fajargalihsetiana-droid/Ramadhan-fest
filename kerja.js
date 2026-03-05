const {
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require("discord.js")

module.exports = (client)=>{

let kerjaProgress = {}
let kerjaCooldown = {}

function progressBar(step){

const total = 5

const done = "🟩".repeat(step)
const left = "⬜".repeat(total-step)

return done + left

}

/* ================= START ================= */

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton()) return

/* ================= MULAI ================= */

if(interaction.customId === "kerja_start"){

const now = Date.now()

if(kerjaCooldown[interaction.user.id] && now < kerjaCooldown[interaction.user.id]){

const wait = Math.ceil((kerjaCooldown[interaction.user.id]-now)/60000)

return interaction.reply({
content:`⏳ Tunggu ${wait} menit sebelum kerja lagi.`,
ephemeral:true
})

}

/* cek rank */

const sorted = Object.entries(data)
.sort((a,b)=>b[1].points-a[1].points)

const rankIndex = sorted.findIndex(e=>e[0]===interaction.user.id)

if(rankIndex === 0 || rankIndex === 1){

return interaction.reply({
content:"⚠️ Rank #1 dan #2 tidak boleh kerja.",
ephemeral:true
})

}

kerjaProgress[interaction.user.id] = 0

const embed = new EmbedBuilder()

.setTitle("🧹 KERJA RAMADHAN")

.setDescription(`
Membersihkan masjid...

Progress
${progressBar(0)}
`)

.setColor("Green")

const row = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId("kerja_do")
.setLabel("🧹 Kerja")
.setStyle(ButtonStyle.Primary)

)

return interaction.reply({
embeds:[embed],
components:[row],
ephemeral:true
})

}

/* ================= PROGRESS ================= */

if(interaction.customId === "kerja_do"){

if(!(interaction.user.id in kerjaProgress)){

return interaction.reply({
content:"Klik **Mulai Kerja** dulu.",
ephemeral:true
})

}

kerjaProgress[interaction.user.id]++

const step = kerjaProgress[interaction.user.id]

/* selesai */

if(step >= 5){

const rewards = [100,120,150,180,220]

const reward = rewards[Math.floor(Math.random()*rewards.length)]

const user = getUser(interaction.user.id)

user.points += reward

saveData()

await updateLeaderboard(interaction.guild)

kerjaCooldown[interaction.user.id] = Date.now() + 2700000

delete kerjaProgress[interaction.user.id]

return interaction.update({

content:`✨ Kerja selesai!\n\n💰 +${reward} poin\n🏆 Total: ${user.points}`,

embeds:[],
components:[]

})

}

/* update progress */

const embed = new EmbedBuilder()

.setTitle("🧹 KERJA RAMADHAN")

.setDescription(`
Membersihkan masjid...

Progress
${progressBar(step)}
`)

.setColor("Green")

return interaction.update({
embeds:[embed]
})

}

})

}