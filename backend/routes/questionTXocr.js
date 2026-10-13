// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
// 腾讯云 OCR 路由：凭据仅从环境变量读取。
const express = require('express');
const https = require('https');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();

// 辅助函数：SHA256哈希
function sha256(message, secret = "", encoding) {
    const hmac = crypto.createHmac("sha256", secret);
    return hmac.update(message).digest(encoding);
}

// 辅助函数：获取哈希值
function getHash(message, encoding = "hex") {
    const hash = crypto.createHash("sha256");
    return hash.update(message).digest(encoding);
}

// 辅助函数：获取日期
function getDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = ("0" + (date.getUTCMonth() + 1)).slice(-2);
    const day = ("0" + date.getUTCDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

// 腾讯OCR识别接口
router.post('/ocr', async (req, res) => {
    const SECRET_ID = process.env.TENCENT_SECRET_ID || '';
    const SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';
    const TOKEN = "";
    if (!SECRET_ID || !SECRET_KEY) {
        return res.status(503).json({ error: '未配置腾讯云 OCR 凭据' });
    }

    const host = "ocr.tencentcloudapi.com";
    const service = "ocr";
    const region = "";
    const action = "QuestionOCR";
    const version = "2018-11-19";
    const timestamp = parseInt(String(new Date().getTime() / 1000));
    const date = getDate(timestamp);
    const payload = JSON.stringify(req.body);

    const signedHeaders = "content-type;host";
    const hashedRequestPayload = getHash(payload);
    const httpRequestMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const canonicalHeaders =
        "content-type:application/json; charset=utf-8\n" + "host:" + host + "\n";

    const canonicalRequest =
        httpRequestMethod +
        "\n" +
        canonicalUri +
        "\n" +
        canonicalQueryString +
        "\n" +
        canonicalHeaders +
        "\n" +
        signedHeaders +
        "\n" +
        hashedRequestPayload;

    const algorithm = "TC3-HMAC-SHA256";
    const hashedCanonicalRequest = getHash(canonicalRequest);
    const credentialScope = date + "/" + service + "/" + "tc3_request";
    const stringToSign =
        algorithm +
        "\n" +
        timestamp +
        "\n" +
        credentialScope +
        "\n" +
        hashedCanonicalRequest;

    const kDate = sha256(date, "TC3" + SECRET_KEY);
    const kService = sha256(service, kDate);
    const kSigning = sha256("tc3_request", kService);
    const signature = sha256(stringToSign, kSigning, "hex");

    const authorization =
        algorithm +
        " " +
        "Credential=" +
        SECRET_ID +
        "/" +
        credentialScope +
        ", " +
        "SignedHeaders=" +
        signedHeaders +
        ", " +
        "Signature=" +
        signature;

    const headers = {
        Authorization: authorization,
        "Content-Type": "application/json; charset=utf-8",
        Host: host,
        "X-TC-Action": action,
        "X-TC-Timestamp": timestamp,
        "X-TC-Version": version,
    };

    if (region) {
        headers["X-TC-Region"] = region;
    }
    if (TOKEN) {
        headers["X-TC-Token"] = TOKEN;
    }

    const options = {
        hostname: host,
        method: httpRequestMethod,
        headers,
    };

    const reqToTencent = https.request(options, (resFromTencent) => {
        let data = "";
        resFromTencent.on("data", (chunk) => {
            data += chunk;
        });

        resFromTencent.on("end", async () => {
            try {
                const result = JSON.parse(data);
                if (result?.Response?.QuestionInfo) {
                    // result.Response.QuestionInfo.forEach(question => {
                    //     delete question.ImageBase64;
                    // });
                    // console.log('1级-处理后的结构化数据：', JSON.stringify(result, null, 2));
                    const originalData = result.Response.QuestionInfo;
                    // console.log('1级-处理后的结构化数据：', JSON.stringify(originalData, null, 2));
                    const figure = originalData[0]?.ResultList?.[0]?.Figure?.find(Figure => Figure.Coord) || null;
                    // console.log('1级-figure数据：', JSON.stringify(figure, null, 2));
                    result.Response.Figure = figure;
                    const newData = {
                        type: "multiple_choice",
                        question: originalData[0]?.ResultList?.[0]?.Question?.[0]?.Text || '题目内容缺失',
                        options: originalData[0]?.ResultList?.[0]?.Option?.map(option => option.Text) || [],
                        answer: originalData[0]?.ResultList?.[0]?.Option?.find(option => option.Text)?.Index - 1,
                        AandQ: null,
                        Ques: null,
                    };
                    
                    // console.log('2级-处理后的结构化数据：', newData);
                    
                    // 新增AI服务调用
                    async function validateWithAI(questionData) {
                      try {
                        //  {role: "system",content: '任务：  请将以下文本中的数学公式用 LaTeX 语法格式化，确保： - 把latex代码使用（\`\`\`）包裹起来，例如：\`\`\`latex\`\`\` - 数学公式用 `$...$` 或 `\\(...\\)` 包裹  - 数学公式中涉及的特殊字符（如 `\`, `{`, `}` 等）需要正确转义  - 普通文本和 LaTeX 公式混排在同一段中  - 在逻辑段落之间插入换行符（`\n` 或 `<br />`）  - 格式整洁、对齐良好'},
                        // {role: 'system', content: '这是举例\begin{aligned}&\text{4. 下面表达式中不属于本构方程的是（D）} \\&\text{A.} \quad \vec{D} = \varepsilon \vec{E}, \\&\text{B.} \quad \vec{J} = \sigma \vec{E}, \\&\text{C.} \quad \mu \vec{H} = \vec{B}, \\&\text{D.} \quad \nabla \cdot \vec{J} = -\frac{\partial \rho}{\partial t}\end{aligned}'},
                                
                        const response = await axios.post(
                          'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                          {
                            model: 'doubao-1-5-lite-32k-250115',
                            messages: [
                                {
                                  role: 'user',
                                  content: '这是一段json格式的数学题，可能是选择题也可能是填空题，识别题目类型修改type字段，如果是选择题就填写为multiple_choice，如果是填空题就填写fill_in_the_blank。其中answer字段是数学题答案，这个结果不一定正确，要求你查看数学题，参考例子处理选项格式并删除options字段内不是选项的参数，然后思考正确答案，填写在answer字段。把数学题的解析填写在AandQ字段，把完整数学题处理成例子里面的形式之后填写在Ques字段，尽返回给我json格式。这是第一个举例“\\\\begin{aligned} &\\\\text{4. 下面表达式中不属于本构方程的是（D）} \\\\\\\\   &\\\\text{A.} \\\\quad \\\\vec{D} = \\\\varepsilon \\\\vec{E}, \\\\\\\\   &\\\\text{B.} \\\\quad \\\\vec{J} = \\\\sigma \\\\vec{E}, \\\\\\\\   &\\\\text{C.} \\\\quad \\\\mu \\\\vec{H} = \\\\vec{B}, \\\\\\\\   &\\\\text{D.} \\\\quad \\\\nabla \\\\cdot \\\\vec{J} = -\\\\frac{\\\\partial \\\\rho}{\\\\partial t} \\\\end{aligned}”这是第二个例子“ \\\\begin{aligned}   &\\\\text{4.如图，已知P是\\\\(\\\\triangle\\\\)ABC边AB上的一点，连接CP.以下条件中不能判定\\\\(\\\\triangle\\\\)ACP\\\\(\\\\triangle\\\\)ABC的是() }\\\\\\\\   &\\\\text{A.} \\\\angle ACP = \\\\angle B \\\\\\\\   &\\\\text{B.} \\\\angle APC = \\\\angle ACB \\\\\\\\   &\\\\text{C.} AC^{2} = AP·AB \\\\\\\\   &\\\\text{D.} \\\\frac{AC}{CP} = \\\\frac{AB}{BC} \\\\end{aligned}”注意 1， LaTeX 公式中的 \ 需要用 \\\\ 进行转义；2，输出必须是完整的、符合 JSON 标准的字符串格式。下面是json数据' 
                                  + JSON.stringify(newData)
                                  
                                }
                              ]
                            },
                            {
                              headers: {
                                'Authorization': `Bearer ${process.env.DOUBA_API_KEY || ''}`,
                                'Content-Type': 'application/json'
                              }
                            }
                          );
                      
                          const aiResult = response.data;
                          // console.log('======3级-原始AI结果：', aiResult);
                        //    console.log('3级-AI结果：', response.data. choices[0].message );
                        if (aiResult?.choices?.[0]?.message?.content) {
                          const aiResponse = JSON.parse(aiResult.choices[0].message.content);
                          questionData.answer = aiResponse.answer;
                          questionData.AandQ = aiResponse.AandQ;
                          questionData.Ques = aiResponse.Ques;
                          // console.log('3级-AI验证后的数据：', JSON.stringify(questionData, null, 2));
                          
                          
                          const aQues = questionData.Ques
                          .replace(/\\\\\\\\\\\\\\\\/g, '\\\\') // 8 个反斜杠 -> 2 个
                          .replace(/\\\\\\\\/g, '\\') // 4 个反斜杠 -> 1 个                            
                          .replace(/\\text\{([^\}]+)\}/g, (_, text) => `\\text{${text}}`); // 保持 LaTeX 格式完整性

                          // 将处理后的LaTeX代码添加到响应中
                          result.Response.aQues = aQues;
                          
                          // 同时添加到processedData对象中，确保前端能接收到
                          questionData.aQues = aQues;
                          
                          // 输出结果
                          console.log('==========处理后的LaTeX代码：==========', aQues);
                        }
                        return questionData;
                      } catch (error) {
                        console.error('==========AI验证失败：==========', {
                          error: error.message,
                          question: questionData.question,
                          requestBody: JSON.stringify({
                            model: 'doubao-1-5-lite-32k-250115',
                            messages: [/* 原始消息内容 */]
                          }),
                          responseStatus: error.response?.status
                        });
                        if (error.response) {
                            console.error('==========AI服务返回错误：==========', {
                              status: error.response.status,
                              data: error.response.data
                            });
                          }
                        return questionData;
                        }
                      }
                      
                    // 使用await等待validateWithAI函数完成后再发送响应
                    try {
                      const processedData = await validateWithAI(newData);
                      console.log('==========3级-处理后的结构化数据：==========', JSON.stringify(processedData, null, 2));
                      
                      // 确保result.Response对象也包含aQues字段
                      if (processedData.aQues) {
                        result.Response.aQues = processedData.aQues;
                      }
                      
                      // 确保processedData对象包含aQues字段
                      // 这是修复的关键部分，确保使用questionData的aQues字段
                      if (!processedData.aQues && result.Response.aQues) {
                        processedData.aQues = result.Response.aQues;
                      }
                      
                      // 再次确认aQues字段已正确设置，这是为了解决处理后的LaTeX代码和最终发送的aQues参数不同的问题
                      // console.log('processedData.aQues的LaTeX代码：', processedData.aQues);
                      
                      // 将处理后的数据发送给前端
                      res.json(processedData);
                    //   console.log('processedData.aQues的LaTeX代码：', processedData.aQues);

                    } catch (error) {
                      console.error('==========处理数据时出错：==========', error);
                      res.json(newData); // 如果处理失败，返回原始数据
                    }
                } else {
                  // 如果没有QuestionInfo，直接返回原始数据
                  res.json(result);
                }
            } catch (e) {
                console.error('==========数据处理异常：===========', {
                    error: e.message
                });
                // 发生异常时，返回原始数据
                res.status(500).json({ error: '数据处理异常', message: e.message });
            }
        });
    });

    reqToTencent.on("error", (error) => {
        console.error(error);
        res.status(500).send('Error occurred while making request to Tencent OCR');
    });
    
    reqToTencent.write(payload);
    reqToTencent.end();
});

module.exports = router;