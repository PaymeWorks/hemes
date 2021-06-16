import axios, { AxiosInstance } from 'axios'

import { sleep } from '@hemes/core'

import { IQOptionAccount } from './IQOptionAccount'
import {
  BaseIQOptionAccount,
  BaseIQOptionProvider,
  Candle,
  LogInCredentials,
} from './types'
import { GetCandlesRequest } from './websocket/events/requests/GetCandles'
import { SsidRequest } from './websocket/events/requests/SSID'
import {
  CandleResponseData,
  GetCandlesResponse,
} from './websocket/events/responses/GetCandles'
import { WebSocketClient } from './websocket/WebSocketClient'

interface LoginResponse {
  code: string
  ssid: string
}

export class IQOptionProvider implements BaseIQOptionProvider {
  private api: AxiosInstance
  private webSocket: WebSocketClient

  constructor() {
    this.api = axios.create({
      baseURL: 'https://iqoption.com/api',
    })

    this.webSocket = new WebSocketClient()
  }

  public async logIn({
    email,
    password,
  }: LogInCredentials): Promise<BaseIQOptionAccount> {
    this.webSocket.subscribe()

    const authApi = axios.create({
      baseURL: 'https://auth.iqoption.com/api/v2',
    })

    const response = await authApi.post<LoginResponse>('/login', {
      identifier: email,
      password,
    })

    this.api.defaults.headers.Authorization = `SSID ${response.data.ssid}`

    if (response.data.code !== 'success') {
      throw new Error('Login failed')
    }

    await this.webSocket.send(SsidRequest, response.data.ssid)

    await sleep(5000)

    const account = new IQOptionAccount(this.api, this.webSocket)

    await account.setBalanceMode('practice')

    return account
  }

  public async getCandles(
    active: number,
    interval: string | number,
    amount: number,
    endtime: number
  ): Promise<Candle[]> {
    const getCandlesRequest = await this.webSocket.send(GetCandlesRequest, {
      active_id: active,
      interval,
      endtime,
      amount,
    })

    const getCandlesResponse = await this.webSocket.waitFor<CandleResponseData>(
      GetCandlesResponse,
      {
        requestId: getCandlesRequest.request_id,
      }
    )

    if (!getCandlesResponse) {
      throw new Error('Candles not found')
    }

    return getCandlesResponse.msg.candles
  }
}
