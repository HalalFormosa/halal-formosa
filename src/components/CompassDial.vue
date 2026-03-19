<template>
  <div class="compass-wrapper">
    <div
        class="dial"
        :style="{ transform: `rotate(${-rotation}deg)` }"
    >
      <div
          v-if="qibla !== null"
          class="kaaba-arm"
          :style="{ transform: `rotate(${qibla}deg)` }"
      >
        <div class="kaaba">🕋</div>
      </div>

      <span
          v-for="deg in 12"
          :key="deg"
          class="tick major"
          :style="{ transform: `rotate(${(deg - 1) * 30}deg)` }"
      />
      <span class="label n">N</span>
      <span class="label e">E</span>
      <span class="label s">S</span>
      <span class="label w">W</span>
    </div>

    <div class="needle" :class="{ aligned }"></div>
    <div class="center-dot"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rotation: number
  qibla: number | null
  aligned?: boolean
}>()

</script>

<style scoped>
.compass-wrapper {
  position: relative;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.05), rgba(0,0,0,0.4));
  border: 2px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dial {
  position: absolute;
  width: 100%;
  height: 100%;
  /* This transition helps the initial "snap" to North feel polished */
  transition: transform 0.6s cubic-bezier(0.1, 0, 0.2, 1);
}

/* When the sensor is active and has data, we reduce the transition
   so it feels like a real physical needle following your hand */
.dial:not([style*="rotate(0deg)"]) {
  transition: transform 0.1s linear;
}

.kaaba-arm {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  display: flex;
  justify-content: center; /* Center horizontally */
  z-index: 5;
}

.kaaba {
  transform: translateY(20px); /* Adjust distance from center */
  font-size: 28px;
}

.tick {
  position: absolute;
  top: 10px;
  left: calc(50% - 1px);
  width: 2px;
  height: 15px;
  background: white;
  transform-origin: center 130px;
}

.label {
  position: absolute;
  font-weight: bold;
  color: white;
}
.n { top: 30px; left: 50%; transform: translateX(-50%); }
.e { right: 30px; top: 50%; transform: translateY(-50%); }
.s { bottom: 30px; left: 50%; transform: translateX(-50%); }
.w { left: 30px; top: 50%; transform: translateY(-50%); }

.needle {
  position: absolute;
  top: 20px;
  width: 4px;
  height: 40px;
  background: #ff3b30; /* Bright red for visibility */
  border-radius: 2px;
  z-index: 10;
}

/* Needle alignment glow */
.needle.aligned {
  background: #4cd964;
  box-shadow: 0 0 15px rgba(76, 217, 100, 0.6);
  transform: scaleY(1.1); /* Subtle "pop" when aligned */
  transition: all 0.2s ease;
}
</style>
