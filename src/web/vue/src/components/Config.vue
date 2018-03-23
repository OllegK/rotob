<template>
  <div>
    <h1>{{ msg }}</h1>
  </div>
</template>

<script>
// import axios from 'axios'

export default {
  name: 'Config',
  data () {
    return {
      msg: 'Config'
    }
  },
  methods: {
    getConfig () {

    }
  },
  beforeMount () {
    console.log('before mount')
  }
}
</script>
