import axios from 'axios'
import router from '../router'
import db from '../utils/sessionStorage'
import * as common from './common'

// 防止刷新token请求后的其他请求重复刷新
let isRefreshing = false;
// 将刷新token请求完成前的请求进行存储，等待完成刷新后请求
let requestQueue = [];



axios.interceptors.response.use(success => {
    if (success.status && success.status == 200 && success.data.status == 500) {
        alert(success.data.msg);
        return;
    }
    return success.data;
}, error => {
    const originalRequest = error.config;

    if (error.response.status == 504 || error.response.status == 404) {
        console.log("504||404")
        alert('服务器迷路了( ╯□╰ )，再试一次吧。');
    } else if (error.response.status == 403) {
        console.log("403")
        alert('权限不足，请联系管理员');
    } else if(error.response && error.response.status == 401 &&
        error.response.data.code == 3000 &&
        !originalRequest._retry &&
        !originalRequest.url.includes('login')){

        if(isRefreshing){
            return new Promise((resolve, reject) => {
                console.log(originalRequest)
                requestQueue.push({resolve, reject, originalRequest});
            })
        }

        originalRequest._retry = true;
        isRefreshing = true;
        var refreshtoken = db.get("REFRESHTOKEN");
        return getRequest('/account/user/refresh', {},{"token":refreshtoken}).then(async res => {

            // 刷新存储新的token
            db.save("TOKEN", res.data.token);
            db.save("REFRESHTOKEN", res.data.refreshToken);

            // 重发当前请求
            originalRequest.headers.token = res.data.token;
            const originalReuestRes = await axios(originalRequest);

            requestQueue.forEach(pending => {
                pending.originalRequest.token = res.data.token;
                axios(pending.originalRequest)
                    .then(resp => pending.resolve(resp))
                    .catch(err => pending.reject(err));
            });
            requestQueue = [];

            return originalReuestRes;
        }).catch(console.log("error"))
            .finally(() => {
                isRefreshing = false;
            })
    }
    else if (error.response.status == 401) {
        console.log("401");
        // 防止重复弹出消息
        if(db.get("LOGINFLAG") == "0"){
            alert('尚未登录或登录状态已过期，请登录')
            db.remove("LOGINFLAG")
            db.save("LOGINFLAG","1")
        }
        router.replace('/');
    } else if (error.response.status == 429) {
        console.log("429");
        alert('骚年，你的手速有点快哦！(￣.￣)...')
    } else {
        console.log("else");
        alert('未知错误!')

    }
    return Promise.reject(error);
})

let base = common.baseApi;

export const postKeyValueRequest = (url, params) => {
    return axios({
        method: 'post',
        url: `${base}${url}`,
        data: params,
        transformRequest: [function (data) {
            let ret = '';
            for (let i in data) {
                ret += encodeURIComponent(i) + '=' + encodeURIComponent(data[i]) + '&'
            }
            return ret;
        }],
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
}
export const postRequest = (url, params, headers) => {
    return axios({
        method: 'post',
        url: `${base}${url}`,
        data: params,
        headers: headers
    })
}
export const putRequest = (url, params) => {
    return axios({
        method: 'put',
        url: `${base}${url}`,
        data: params
    })
}
export const getRequest = (url, params, headers) => {
    let apiUrl = `${base}${url}`;
    apiUrl = getApiUrl(apiUrl,params);
    // 请求
    return axios({
        method: 'get',
        url: apiUrl,
        data: params,
        headers: headers
    })
}
export const deleteRequest = (url, params) => {
    let apiUrl = `${base}${url}`;
    apiUrl = getApiUrl(apiUrl,params);
    return axios({
        method: 'delete',
        url: apiUrl,
        data: params
    })
}

// 处理参数转换
function getApiUrl(url,params){
    let apiUrl = url;
    let i = 0;
    for (const key in params) {
        const value = params[key];
        const param = key+"="+value;
        let s = '?';
        if ( i > 0 ){
            s = '&';
        }
        apiUrl = apiUrl+s+param;
        i++;
    }
    return apiUrl;
}