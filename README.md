# FECAP - Fundação de Comércio Álvares Penteado

<p align="center">
<a href="https://www.fecap.br/"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhZPrRa89Kma0ZZogxm0pi-tCn_TLKeHGVxywp-LXAFGR3B1DPouAJYHgKZGV0XTEf4AE&usqp=CAU" alt="FECAP - Fundação de Comércio Álvares Penteado"></a>
</p>

---

# Projeto InovaTech — Dashboard Inteligente Cannoli

## 👨‍💻 Projeto 6

### **Integrantes:**  
- [Adeilson Nunes da Costa](https://www.linkedin.com/in/adeilson-da-costa-3013871b1/)
- [Bruna Cristina Lira](https://www.linkedin.com/in/brunacristinalira/)  
- [Daniela Giacomo Pauzer](https://www.linkedin.com/in/daniela-giacomo-pauzer-a25a64304/)
- [Enzo Sangiacomo Duela de Andrade](https://www.linkedin.com/in/enzo-sangiacomo-3203602b3/) 
- [Rafaela Coelho Bastos](https://www.linkedin.com/in/rafaela-coelho-bastos/)

### **Professores Orientadores:**  
- [Aimar Lopes](https://www.linkedin.com/in/aimarlopes/) 
- [Ronaldo Araujo Pinto](https://www.linkedin.com/in/ronaldo-araujo-pinto-3542811a/)
- [Eduardo Savino Gomes](https://www.linkedin.com/in/eduardo-savino/)
- [Edson Barbero](https://www.linkedin.com/in/edsonbarbero/)
- [Lucy Mari Tabuti](https://www.linkedin.com/in/lucymari/)

---

## 📖 Descrição

<p align="center">
<img src="Imagens/ChatGPT Image 19 de set. de 2025, 19_52_55.png" alt="InovaTech" width="250">
</p>

A **InovaTech** desenvolve um **dashboard interativo e inteligente** para a startup **Cannoli**, que atua no setor de foodtech e oferece uma plataforma de CRM, engajamento, cardápio digital e delivery próprio.

O objetivo é fornecer uma ferramenta de **análise estratégica e operacional**, tanto para administradores da Cannoli quanto para clientes (restaurantes e negócios parceiros), permitindo acompanhar indicadores em tempo real, gerar insights com IA e otimizar a jornada do cliente.

O projeto foi totalmente implementado com **backend próprio hospedado na Render** e **frontend responsivo hospedado na Vercel**, com integração via API e ambiente profissional.

### 🔗 Links da Aplicação:
- **Frontend (Vercel):** https://facul-projeto-six.vercel.app  
- **Backend (Render):** https://inovatech-backend.onrender.com  

---

## 🚀 Funcionalidades Principais

- ✅ **Autenticação de Usuários:** login separado para admin e cliente.  
- ✅ **Visualização de KPIs:** consumo, vendas, ticket médio, churn, campanhas e mais.  
- ✅ **Gráficos Interativos e Filtros:** período, canal, loja e métricas.  
- ✅ **Alertas Inteligentes:** detecção automática de anomalias.  
- ✅ **Sugestões Automáticas com IA:** insights de otimização baseados nos dados.  
- ✅ **Exportação de Relatórios:** PDF, CSV e Excel.  
- ✅ **Simulação de Campanhas:** previsão de impacto estimado (módulo admin).  
- ✅ **Dashboard Admin Completo:** visão geral de restaurantes, ranking e KPIs gerais.  
- ✅ **Integração com Backend Real:** APIs Flask hospedadas e acessadas dinamicamente.  

---

## 🛠 Estrutura de pastas

-Raiz<br>
|<br>
|-->Documentos<br>
  &emsp;|-->entrega 1<br>
  &emsp;|-->entrega 2<br>
  &emsp;|-->entrega final <br>
|-->imagens<br>
|-->src<br>
  &emsp;|-->Backend<br>
  &emsp;|-->Frontend<br>
|.gitignore<br>
|readme.md<br>

A pasta raiz contém dois arquivos que devem ser alterados:

<b>README.MD</b>: Arquivo que serve como guia e explicação geral sobre seu projeto.  

<b>documentos</b>: Pasta com todas as entregas solicitadas na disciplina.  

<b>imagens</b>: Prints e imagens do projeto.  

<b>src</b>: Contém todo o código do sistema, dividido em:

- **Backend:** Flask + SQLite + JWT, hospedado na Render  
- **Frontend:** React + Vite, hospedado na Vercel  

---

## 🎨 Protótipo no Figma

Confira o design e interações da **InovaTech** no  
👉 **[Figma](https://www.figma.com/design/gYkYdXLLX3oQbFMWBO6z7w/Untitled?node-id=0-1&p=f&t=rqTsD4xgTjr1SmBP-0)**

---

## 🛠 Linguagens e Tecnologias Usadas

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="50" height="50" alt="React"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" width="50" height="50" alt="Python"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sqlite/sqlite-original.svg" width="50" height="50" alt="MySQL"/>
</p>

- **Frontend:** React.js + Vite  
- **Backend:** Flask (Python)  
- **Banco de Dados:** SQLite  
- **Bibliotecas de IA:** NumPy  
- **Visualização:** Chart.js  
- **Autenticação:** JWT  
- **Hospedagem:**  
  - Backend → Render  
  - Frontend → Vercel  

---

## 📌 Estrutura do Aplicativo (Dashboard)

- 📌 **Login & Cadastro:** segurança e fluxo separado por perfil.  
- 📌 **Dashboard Principal:** KPIs atualizados dinamicamente.  
- 📌 **Gráficos Interativos:** vendas por semana, resumo por canal, evolução temporal.  
- 📌 **Painel de Alertas:** detecção automática de picos fora do padrão.  
- 📌 **Sugestões Inteligentes:** baseadas em modelos estatísticos.  
- 📌 **Top Itens:** ranking dos produtos mais vendidos.  
- 📌 **Simulador de Campanhas (Admin):** previsão de resultados.  
- 📌 **Exportação de Dados:** PDF, Excel e CSV.  
- 📌 **Admin Dashboard:**  
  - visão geral dos restaurantes,  
  - ranking dos top 3,  
  - gráficos avançados,  
  - filtros especiais.  

---

## 📋 Licença/License
<a href="https://creativecommons.org">InovaTech</a> © 2025 — licenciado sob <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>  
<img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" style="max-width: 1em;margin-left:.2em;">
<img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" style="max-width: 1em;margin-left:.2em;">

---

## 🎓 Referências

1. https://github.com/iuricode/readme-template  
2. https://github.com/gabrieldejesus/readme-model  
