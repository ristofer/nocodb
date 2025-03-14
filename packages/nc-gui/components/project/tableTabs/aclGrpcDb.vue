<template>
  <div>
    <v-card style="">

      <v-toolbar flat height="42" class="toolbar-border-bottom">
        <v-toolbar-title>
          <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        },
        {
          text: this.nodes.tn + ' (ACL)',
          disabled: true,
          href: '#'
        }]" divider=">" small>
            <template v-slot:divider>
              <v-icon small color="grey lighten-2">forward</v-icon>
            </template>
          </v-breadcrumbs>

        </v-toolbar-title>
        <v-spacer></v-spacer>
        <x-btn outlined tooltip="Reload ACL"
               color="primary"
               small
               v-ge="['acl-gql','reload']"
               @click="aclInit"
        >
          <v-icon small left>refresh</v-icon>
          Reload
        </x-btn>
        <x-btn tooltip="Open ACL Folder"
               icon="mdi-folder-open"
               outlined
               small v-ge="['acl-gql','open-folder']"
               color="primary"
               @click="openFolder">
          Open Folder
        </x-btn>
        <x-btn outlined tooltip="Save ACL"
               color="primary"
               class="primary"
               small
               @click="save"
               :disabled="disableSaveButton"
               v-ge="['acl-gql','save']">
          <v-icon small left>save</v-icon>
          Save
        </x-btn>

      </v-toolbar>

      <v-text-field dense hide-details class="ma-2" :placeholder="`Search ${nodes.tn} resolvers`"
                    prepend-inner-icon="search" v-model="search"
                    outlined></v-text-field>

      <v-simple-table v-if="policies && policies.length" dense>
        <thead>
        <tr>

          <th colspan="2" class="text-center" rowspan="2">

            <div class="d-flex justify-center">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-checkbox
                    small v-ge="['acl-gql','open-folder']" v-on="on" class="mt-1 flex-shrink-1" dense
                    v-model="allToggle"></v-checkbox>
                </template>
                <span>{{ allToggle ? 'Disable' : 'Enable' }} all {{ nodes.tn }} resolvers for all roles</span>
              </v-tooltip>
              <span class="title">{{ nodes.tn }} RPC Services</span>
            </div>

          </th>
          <th v-for="role in roles"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey">
            <div class="d-flex align-center justify-center">
              <span>{{ role }}</span>
            </div>
          </th>

        </tr>
        <tr>

          <th v-for="role in roles"
              class="pa-1"
              style="border-left: 1px solid grey;border-bottom: 1px solid grey">
            <div class="d-flex justify-center">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-checkbox
                    small v-ge="['acl-gql','open-folder']" v-on="on" class="mt-0" dense v-model="columnToggle[role]"
                    @change="toggleColumn(role,columnToggle[role])"></v-checkbox>
                </template>
                <span>
                  <span>{{ columnToggle[role] ? 'Disable' : 'Enable' }} all resolvers for {{ role }}</span></span>
              </v-tooltip>
            </div>
          </th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="(resolver,path) in data1" v-show="!search || path.toLowerCase().indexOf(search.toLowerCase()) > -1">
          <td width="20" class="pl-6 pr-3">

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox
                  small v-ge="['acl-gql','open-folder']" v-on="on" class="mt-0 ml-3" v-model="rowToggle[path]"
                  @change="toggleRow(path,rowToggle[path])"
                  dense></v-checkbox>
              </template>

              <span>{{ rowToggle[path] ? 'Disable' : 'Enable' }} this resolver for all roles</span>
            </v-tooltip>
          </td>
          <td class="pl-0">

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <span v-on="on">{{ path }}</span>
              </template>
              <span>{{ path }}</span>
            </v-tooltip>
          </td>
          <template v-for="(role,i) in roles">
            <td style="border-left: 1px solid grey" class="pa-1" :key="`${path}_${role}`">
              <div class="d-flex justify-center">
                <v-checkbox
                  small v-ge="['acl-gql','open-folder']" class="mt-0" dense
                  v-model="data1[path][role]"
                  @change="toggleCell(path,role,data1[path][role])"
                ></v-checkbox>
              </div>
            </td>
          </template>

        </tr>
        </tbody>
      </v-simple-table>


      <v-alert v-else-if="policies" outlined type="info">Permission file not found</v-alert>
    </v-card>
  </div>
</template>

<script>
import {mapGetters} from "vuex";


// const {fs, importFresh, shell, path} = require("electron").remote.require('./libs');

export default {
  name: "acl-grpc-db",

  props: ["nodes"],
  methods: {
    openFolder() {
      shell.openItem(path.dirname(this.policyPath));
    },
    toggleColumn(role, checked) {
      for (let [resolver, roles] of Object.entries(this.data1)) {
        this.$set(roles, role, checked)
        this.toggleCell(resolver, role, checked)
      }
    },
    toggleRow(resolver, checked) {
      for (let role in this.data1[resolver]) {
        this.$set(this.data1[resolver], role, checked)
        this.toggleCell(resolver, role, checked)
      }
    },
    toggleAll(checked) {
      this.disableSaveButton = false;
      for (let path in this.data1) {
        this.rowToggle[path] = checked;
      }
      for (let role of this.roles) {
        this.columnToggle[role] = checked;
      }

      for (let roles of Object.values(this.data1)) {
        for (let role of this.roles) {
          this.$set(roles, role, checked)
        }
      }
    },
    toggleCell(resolver, role, checked) {
      this.disableSaveButton = false;
      this.$set(this.columnToggle, role, Object.values(this.data1).some(roles => roles[role]));
      this.$set(this.rowToggle, resolver, Object.values(this.data1[resolver]).some(enabled => enabled));
    },
    initColumnCheckBox() {
      for (let role of this.roles) {
        this.columnToggle[role] = Object.values(this.data1).some(roles => roles[role]);
      }
    },
    initRowCheckBox() {
      for (let path in this.data1) {
        this.rowToggle[path] = Object.entries(this.data1[path]).filter(([role, v]) => {
          if (!this.roles.includes(role)) this.roles = [...this.roles, role];
          return v;
        }).length;
      }
    },
    async aclInit() {
      try {
        console.log(this.sqlMgr)
        this.disableSaveButton = true;
        // this.policies = (await this.sqlMgr.projectGetGrpcPolicyFromDb({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias,
        //   tn: this.nodes.tn
        // })).data.list;
        this.policies = (await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'projectGetGrpcPolicyFromDb', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.nodes.tn
        }])).data.list;

        //.data.list;
        this.data = JSON.parse(JSON.stringify(this.policies.filter(({service}) => service)));
        this.data1 = this.data.reduce((aclObj, resolver) => {
          aclObj[resolver.service] = resolver.acl;
          return aclObj;
        }, {});

        this.initColumnCheckBox();
        this.initRowCheckBox();
      } catch (e) {
        console.log(e)
      }
    },
    async save() {
      try {

        //
        // await this.sqlMgr.xcRpcPolicyUpdate({
        //   env: this.nodes.env,
        //   dbAlias: this.nodes.dbAlias,
        //   tn: this.nodes.tn,
        //   data: this.data
        // })


        await this.$store.dispatch('sqlMgr/ActSqlOp', [null, 'xcRpcPolicyUpdate', {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias,
          tn: this.nodes.tn,
          data: this.data
        }])


        this.disableSaveButton = true;
        this.$toast.success(`${this.policyPath} updated successfully`).goAway(3000);
      } catch (e) {
        console.log(e);
        this.$toast.error(`${this.policyPath} updating failed`).goAway(3000);
      }
    }
  },
  data() {
    return {
      disableSaveButton: true,
      search: '',
      policyPath: '',
      policies: null,
      columnToggle: {},
      rowToggle: {},
      roles: [
        'creator',
        'editor',
        'guest'
      ],
      data1: null
    }
  },
  computed: {
    ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
    allToggle: {
      get() {
        return this.data1 && Object.values(this.data1).some(roles => Object.values(roles).some(v => v))
      },
      set(checked) {
        this.toggleAll(checked)
      }
    }
  },
  async mounted() {
    await this.aclInit();
  },
  watch: {}
}
</script>

<style scoped>

</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
