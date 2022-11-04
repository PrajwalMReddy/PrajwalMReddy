<template>
  <nav id="navigation-bar">
    <ul class="navigation-list">
      <li class="navigation-element"><a id="navigation-name" href="/">Prajwal Reddy</a></li>
    </ul>
    <ul class="navigation-list">
      <li class="navigation-element"><a class="navigation-link" href="/projects">Projects</a></li>
      <li class="navigation-element"><a class="navigation-link" href="/blogs">Blogs</a></li>
      <li class="navigation-element"><a class="navigation-link" href="/todo">Todo</a></li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: 'NavBar',
}
</script>

<style scoped>
#navigation-bar {
  background: #272727;
  padding: 5px;

  display: flex;
  display: -webkit-flex;

  justify-content:space-between;
  -webkit-justify-content:space-between;
}

.navigation-list {
  list-style-type: none;
  display: flex;
  display: -webkit-flex;
}

.navigation-element {
  margin: 25px 30px 25px 30px;
}

.navigation-element:hover {
  text-decoration: underline;
}

#navigation-name {
  color: #BEBEBE;

  font-size: 30px;
  text-decoration: none;
}

.navigation-link {
  color: #BEBEBE;

  font-size: 25px;
  text-decoration: none;
}
</style>
