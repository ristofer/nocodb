import {BaseModelSql} from "../../dataMapper";
// import axios from "axios";
import BaseApiBuilder from "./BaseApiBuilder";
import IEmailAdapter from "../../../interface/IEmailAdapter";
import Handlebars from "handlebars";
import {IWebhookNotificationAdapter} from "nc-plugin";

class BaseModel<T extends BaseApiBuilder<any>> extends BaseModelSql {


  private builder: T;

  constructor(args: any, builder: T) {
    super(args);
    this.builder = builder;
  }

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.insert', data, req)
  }


  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.insert', data, req);
    if (req?.headers?.['xc-gui']) {
      const id = this._extractPksValues(data);
      this.builder.getXcMeta().audit(
        this.builder?.getProjectId(),
        this.builder?.getDbAlias(),
        'nc_audit',
        {
          model_name: this._tn,
          model_id: id,
          op_type: 'DATA',
          op_sub_type: 'INSERT',
          description: `${id} inserted into ${this._tn}`,
          // details: JSON.stringify(data),
          ip: req?.clientIp,
          user: req?.user?.email
        }
      )
    }
  }

  public async beforeUpdate(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.update', data, req)
  }

  public async afterUpdate(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.update', data, req)
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.delete', data, req)
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    if (req?.headers?.['xc-gui']) {
      this.builder.getXcMeta().audit(
        this.builder?.getProjectId(),
        this.builder?.getDbAlias(),
        'nc_audit',
        {
          model_name: this._tn,
          model_id: req?.params?.id,
          op_type: 'DATA',
          op_sub_type: 'DELETE',
          description: `${req?.params.id} deleted from ${this._tn}`,
          ip: req?.clientIp,
          user: req?.user?.email
        }
      )
    }
    await this.handleHooks('after.delete', data, req)
  }

  private async handleHooks(hookName, data, req): Promise<void> {
    try {
      if (this.tn in this.builder.hooks
        && hookName in this.builder.hooks[this.tn]
        && this.builder.hooks[this.tn][hookName]
      ) {
        for (const hook of this.builder.hooks[this.tn][hookName]) {
          if (!hook.active) {
            continue
          }
          console.log('Hook handler ::::' + this.tn + '::::', this.builder.hooks[this.tn][hookName])
          console.log('Hook handler ::::' + this.tn + '::::', data)


          if (!this.validateCondition(hook.condition, data, req)) {
            continue;
          }


          switch (hook.notification?.type) {
            case 'Email':
              this.emailAdapter?.mailSend({
                to: this.parseBody(hook.notification?.payload?.to, req, data, hook.notification?.payload),
                subject: this.parseBody(hook.notification?.payload?.subject, req, data, hook.notification?.payload),
                html: this.parseBody(hook.notification?.payload?.body, req, data, hook.notification?.payload)
              })
              break;
            case 'URL':
              this.handleHttpWebHook(hook.notification?.payload)
              break;
            default:
              if (this.webhookNotificationAdapters && hook.notification?.type && hook.notification?.type in this.webhookNotificationAdapters) {
                this.webhookNotificationAdapters[hook.notification.type].sendMessage(this.parseBody(hook.notification?.payload?.body, req, data, hook.notification?.payload), hook.notification?.payload)
              }
              break
          }

          // await axios.post(this.builder.hooks[this.tn][hookName].url, {data}, {
          //   headers: req?.headers
          // })
        }
      }
    } catch (e) {
      console.log('hooks :: error', hookName, e.message)
    }
  }

  private async handleHttpWebHook(apiMeta) {
    try {
      const req = this.axiosRequestMake(apiMeta);
      await require('axios')(req);
    } catch (e) {
      console.log(e)
    }
  }

  private axiosRequestMake(apiMeta) {
    if (apiMeta.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body);
      } catch (e) {
        console.log(e);
      }
    }
    if (apiMeta.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth);
      } catch (e) {
        console.log(e);
      }
    }
    apiMeta.response = {};
    const req = {
      params: apiMeta.parameters ? apiMeta.parameters.reduce((paramsObj, param) => {
        if (param.name && param.enabled) {
          paramsObj[param.name] = param.value;
        }
        return paramsObj;
      }, {}) : {},
      url: apiMeta.path,
      method: apiMeta.method,
      data: apiMeta.body,
      headers: apiMeta.headers ? apiMeta.headers.reduce((headersObj, header) => {
        if (header.name && header.enabled) {
          headersObj[header.name] = header.value;
        }
        return headersObj;
      }, {}) : {},
      withCredentials: true
    };
    return req;
  }


  // @ts-ignore
  private get emailAdapter(): IEmailAdapter {
    return this.builder?.app?.metaMgr?.emailAdapter;
  }


  // @ts-ignore
  private get webhookNotificationAdapters(): { [key: string]: IWebhookNotificationAdapter } {
    return this.builder?.app?.metaMgr?.webhookNotificationAdapters;
  }

  private validateCondition(condition: any, data: any, _req: any) {
    if (!condition || !condition.length) {
      return true;
    }

    const isValid = condition.reduce((valid, con) => {
      let res;
      switch (con.op as string) {
        case 'is equal':
          res = data[con.field] === con.value;
          break;
        case 'is not equal':
          res = data[con.field] !== con.value;
          break;
        case 'is like':
          res = data[con.field]?.toLowerCase()?.indexOf(con.value?.toLowerCase()) > -1;
          break;
        case 'is not like':
          res = data[con.field]?.toLowerCase()?.indexOf(con.value?.toLowerCase()) === -1;
          break;
        case 'is empty':
          res = data[con.field] === '' || data[con.field] === null || data[con.field] === undefined;
          break;
        case 'is not empty':
          res = !(data[con.field] === '' || data[con.field] === null || data[con.field] === undefined);
          break;
        case 'is null':
          res =
            res = data[con.field] === null;
          break;
        case 'is not null':
          res = data[con.field] !== null;
          break;




        /*   todo:     case '<':
                  return condition + `~not(${filt.field},lt,${filt.value})`;
                case '<=':
                  return condition + `~not(${filt.field},le,${filt.value})`;
                case '>':
                  return condition + `~not(${filt.field},gt,${filt.value})`;
                case '>=':
                  return condition + `~not(${filt.field},ge,${filt.value})`;*/
      }


      return con.logicOp === 'or' ? valid || res : valid && res;

    }, true);

    return isValid;
  }

  private parseBody(template: string, req: any, data: any, payload: any): string {
    if (!template) {
      return template;
    }

    return Handlebars.compile(template, {noEscape: true})({
      data,
      user: req?.user,
      payload
    })
  }
}

export default BaseModel;

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
