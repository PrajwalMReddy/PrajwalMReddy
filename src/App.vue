<template>
  <NavBar />
  <HomeAbout />
</template>

<script>
import NavBar from "@/components/NavBar";
import HomeAbout from "@/components/HomeAbout";

export default {
  name: 'App',
  components: {
    HomeAbout,
    NavBar
  },
}
</script>

<style>
@font-face {
  font-family: "JetBrainsMono";
  src: url("./res/JetBrainsMono.woff2") format("woff");
}

body {
  font-family: "JetBrainsMono", serif;
}
</style>
