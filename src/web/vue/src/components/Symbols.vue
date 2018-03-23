<template>
  <div>
    <h1>{{ msg }}</h1>
    <v-btn color="blue" v-on:click.native="clickButton()">Success</v-btn>

  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Symbols',
  data () {
    return {
      msg: 'Symbols'
    }
  },
  methods: {
    async clickButton () {
      console.log('clicking the button')
      let response = await axios.get('http://localhost:3000/api/test')
      console.log(response.data)
    }
  }
}
</script>
