<template>
  <div>
    <h1>{{ msg }}</h1>
    <v-btn color="blue" v-on:click.native="updateSymbols()">Update</v-btn>

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
    async updateSymbols () {
    }
  },
  beforeMount: async () => {
    console.log(this)
    let response = await axios.get('/api/symbols')
    console.log(response.data)
  }
}
</script>
