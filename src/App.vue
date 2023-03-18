<template>
  <NavBar />
  <HomeAbout />
  <HomeExperience />
  <HomeContact />
</template>

<script>
import NavBar from "@/components/NavBar";
import HomeAbout from "@/components/HomeAbout";
import HomeExperience from "@/components/HomeExperience";
import HomeContact from "@/components/HomeContact";

export default {
  name: 'App',
  components: {
    HomeContact,
    HomeExperience,
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
