<template>
  <div id="about-home">
    <img id="about-logo" src="../img/hurricane.png">
    <div id="about-text-div">
      <h1 id="about-text-header">Hello, I'm Prajwal Reddy</h1>
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
}

#about-logo {
  height: auto;
  width: 30%;

  margin: 60px;
}

#about-text-div {
  display: flex;
  justify-content: center;
  flex-direction: column;

  width: 50%;
}

#about-text-header {
  font-size: 60px;
  text-align: center;
}

#about-text {
  font-size: 20px;

  margin: 50px 100px;
}
</style>
