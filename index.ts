#!/usr/bin/env tsx

import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import minimist from 'minimist';
import * as path from 'path';

const argv = minimist(process.argv.slice(2));

const showHelp = () => {
  console.log(`
  Usage
    $ yarn start

  Options
    --token        Gitlab Token Access
    --from         Repository name to download files
    --to           Repository name to upload files

  Examples
    $ yarn start --token="12345" --from="tiagodanin/api-v1" --to="tiagodanin/backend"
`);
};

const gitlab_token: string = argv?.token || '';
const repo_from: string = argv?.from || '';
const repo_to: string = argv?.to || '';

const backupDir = './backup';
const axiosConfig: AxiosRequestConfig = {
  timeout: 30000,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  baseURL: 'https://gitlab.com/api/v4/',
  headers: {
    'PRIVATE-TOKEN': gitlab_token,
  },
};

const main = async () => {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const secureFilesList = await axios({
    ...axiosConfig,
    method: 'GET',
    url: `/projects/${encodeURIComponent(repo_from)}/secure_files`,
  });

  console.log(`Get lists of files (${secureFilesList.data.length})`);

  for (const secureFile of secureFilesList.data) {
    if (!secureFile.name.match(/\.cer$|\.p12$/)) {
      console.log(`Skipping: ${secureFile.name}`);
      continue;
    }
  
    const filePath = path.join(backupDir, secureFile.name);
    const fileDir = path.dirname(filePath);
  
    // Garante que o diretório existe
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
  
    const fileWriter = fs.createWriteStream(filePath);
  
    const response = await axios({
      ...axiosConfig,
      method: 'GET',
      responseType: 'stream',
      url: `/projects/${encodeURIComponent(repo_from)}/secure_files/${secureFile.id}/download`,
    });
  
    const stream = response.data;
    stream.pipe(fileWriter);
  
    await new Promise((resolve, reject) => {
      fileWriter.on('finish', resolve);
      fileWriter.on('error', reject);
    });
  
    console.log(`Download file ${secureFile.name} (${secureFile.id}) of ${repo_from}`);
  
    // Verifica se o arquivo foi baixado corretamente
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      console.error(`Erro: Arquivo ${filePath} está vazio ou não existe.`);
      continue;
    }
  
    // Ajuste para garantir a extensão correta dos certificados
    const extension = path.extname(secureFile.name) || '.p12';
    const newFilePath = `${filePath}${extension}`;
    fs.renameSync(filePath, newFilePath);
  
    const formData = new FormData();
    formData.append('name', secureFile.name);
    formData.append('file', fs.createReadStream(newFilePath));
  
    try {
      await axios({
        ...axiosConfig,
        method: 'POST',
        url: `/projects/${encodeURIComponent(repo_to)}/secure_files`,
        headers: {
          ...axiosConfig.headers,
          ...formData.getHeaders(),
        },
        data: formData,
      });
      console.log(`Upload file ${secureFile.name} (${secureFile.id}) in ${repo_to}`);
    } catch (error) {
      console.error(`Erro ao fazer upload do arquivo ${secureFile.name}:`, error.response?.data || error.message);
    }
  }
  
  console.log('Done!');
};

if (gitlab_token && repo_from && repo_to) {
  main();
} else {
  showHelp();
}
