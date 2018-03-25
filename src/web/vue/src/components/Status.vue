<template>
  <div>
    <h1>{{ msg }}</h1>
    <ul>
      <li>Started at <strong>{{ starttime }}</strong></li>
      <li>Iteration number <strong>{{ nr }}</strong></li>
      <li>Status <strong>{{ status }}</strong></li>
    </ul>
   <v-btn color="blue" v-on:click.native="changeStatus()">{{ status.charAt(0).toUpperCase() + status.slice(1) }}</v-btn>

  </div>
</template>

<script>
import axios from "axios";

export default {
  name: "Status",
  data() {
    return {
      msg: "Status",
      status: "",
      starttime: "",
      nr: -1
    };
  },
  methods: {
    async changeStatus () {
      console.log('clicking the button')
      if (this.status === 'running') {
        this.status = 'paused'
      } else if (this.status === 'paused') {
        this.status = 'running'
      } else {
        this.status = 'unknown'
      }
    }
  },
  beforeMount: async function() {
    console.log("beforeMount in status");

    // todo check if not invoked yet
    // todo for each request ensure that it is authenticated
    //   ctx.body = '{starttime: "starttime", status: "running", nr: "nr"}';
    let response = await axios.get("/api/status");
    console.log(response.data);

    Object.assign(this, response.data);

    console.log(this.status)

    console.log(this);
  },
  mounted: function() {
    console.log("mounted");
  },
  beforeUpdate: function() {
    console.log("beforeUpdate");
  },
  updated: function() {
    console.log("updated");
  }
};
</script>
