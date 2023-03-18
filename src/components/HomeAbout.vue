<template>
  <div id="about-home">
    <div id="about-text-div">
      <h1 id="about-text-header">Hello</h1>
      <h2 id="about-text-subheader">I'm Prajwal Reddy</h2>
      <p id="about-text">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        Phasellus a eros ac dolor laoreet egestas sit amet non mi.
        Sed bibendum finibus tortor, at scelerisque nulla blandit quis.
        Pellentesque posuere arcu hendrerit, condimentum neque at, lobortis ligula.
        Interdum et malesuada fames ac ante ipsum primis in faucibus.
        In arcu sapien, congue id tortor sit amet, ultrices tincidunt augue.
        Duis imperdiet a dolor id consequat. Cras porta et massa et condimentum.
      </p>
    </div>
    <img id="about-img" src="../img/hurricane.png">
  </div>
</template>

<script>
export default {
  name: "HomeAbout"
}
</script>

<style scoped>
#about-home {
  display: flex;
  justify-content: space-evenly;

  margin-left: 50px;
}

#about-text-div {
  display: flex;
  justify-content: center;
  flex-direction: column;

  margin-top: -10px;
  width: 50%;
}

#about-text-header {
  font-size: 60px;
  text-align: justify;
}

#about-text-subheader {
  font-size: 45px;
  text-align: justify;

  margin-top: 10px;
}

#about-text {
  font-size: 20px;

  margin-top: 20px;
}

#about-img {
  height: auto;
  width: 22%;

  margin: 60px;
}
</style>
