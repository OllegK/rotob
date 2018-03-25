<template>

 <!-- <ul class="nav nav-stacked">
  <li><router-link to="/">Status</router-link></li>
  <li><router-link to="/config">About</router-link></li>
  <li><router-link to="/state">State</router-link></li>
  <li><router-link to="/symbols">Symbols</router-link></li>
  </ul> -->

  <v-app id="inspire" dark>
    <v-navigation-drawer
      clipped
      fixed
      v-model="drawer"
      app
    >
      <v-list dense>
       <v-list-tile router-link to="/status">
          <v-list-tile-action>
            <v-icon>dashboard</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Status</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile router-link to="/config">
          <v-list-tile-action>
            <v-icon>settings</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Config</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile router-link to="/state">
          <v-list-tile-action>
            <v-icon>account_balance</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>State</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile router-link to="/symbols">
          <v-list-tile-action>
            <v-icon>euro_symbol</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Symbols</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar app fixed clipped-left>
      <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
      <v-toolbar-title>Robot</v-toolbar-title>
    </v-toolbar>
    <v-content>
      <v-container fluid fill-height>
        <v-layout justify-center align-center>
          <v-flex shrink>
            <router-view/>
          </v-flex>
        </v-layout>
      </v-container>
    </v-content>
    <v-footer app fixed>
      <span>&copy; 2018</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  name: 'App',
  data: () => ({
    drawer: null
  }),
  props: {
    source: String
  }
}
</script>

<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  margin-top: 60px;
}
</style>
