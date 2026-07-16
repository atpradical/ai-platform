import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { CHAT_MODEL } from '../ai/constants';

interface EmbeddingCache {
  contentHash: string;
  documents: { pageContent: string; metadata: Record<string, unknown> }[];
  vectors: number[][];
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private vectorStore: MemoryVectorStore;
  private readonly embeddings: OpenAIEmbeddings;

  private readonly sourcePath = join(process.cwd(), 'src/rag/data/faq.txt');
  private readonly cachePath = join(
    process.cwd(),
    'src/rag/data/.cache/faq.vectors.json',
  );

  constructor(
    @Inject(CHAT_MODEL)
    private readonly model: BaseChatModel,
    private readonly config: ConfigService,
  ) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
      model: 'text-embedding-3-small',
    });
  }

  async onModuleInit() {
    await this.ingest();
  }

  /* Makes chunks and vectors */
  private async ingest() {
    const rawText = await readFile(this.sourcePath, 'utf-8');
    const contentHash = createHash('sha256').update(rawText).digest('hex');

    const cached = await this.loadCache(contentHash);

    this.vectorStore = new MemoryVectorStore(this.embeddings);

    if (cached) {
      // load vectors from cache if valid
      const docs = cached.documents.map(
        (d) =>
          new Document({ pageContent: d.pageContent, metadata: d.metadata }),
      );
      await this.vectorStore.addVectors(cached.vectors, docs);
      this.logger.log(
        `Loaded ${docs.length} chunks from cache (0 embedding API calls)`,
      );
      return;
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,
      chunkOverlap: 50,
    });
    const chunks = await splitter.createDocuments([rawText]);

    const vectors = await this.embeddings.embedDocuments(
      chunks.map((c) => c.pageContent),
    );
    await this.vectorStore.addVectors(vectors, chunks);

    await this.saveCache({
      contentHash,
      vectors,
      documents: chunks.map((c) => ({
        pageContent: c.pageContent,
        metadata: c.metadata,
      })),
    });

    this.logger.log(`Ingested ${chunks.length} chunks via API and saved cache`);
  }

  /* reads cache from file */
  private async loadCache(contentHash: string): Promise<EmbeddingCache | null> {
    if (!existsSync(this.cachePath)) return null;

    try {
      const raw = await readFile(this.cachePath, 'utf-8');
      const parsed: EmbeddingCache = JSON.parse(raw);
      return parsed.contentHash === contentHash ? parsed : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cache: EmbeddingCache) {
    await mkdir(join(process.cwd(), 'src/rag/data/.cache'), {
      recursive: true,
    });
    await writeFile(this.cachePath, JSON.stringify(cache), 'utf-8');
  }

  async ask(question: string) {
    const relevantDocs = await this.vectorStore.similaritySearch(question, 3);
    const context = relevantDocs
      .map((doc: Document) => doc.pageContent)
      .join('\n\n');

    const promptTemplate = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are support assistant. Answer question ONLY on the basis of context below. ' +
          "If no answer in context - truthly say you don't know answer. \n\nContext:\n{context}",
      ],
      ['human', '{question}'],
    ]);

    const chain = promptTemplate
      .pipe(this.model)
      .pipe(new StringOutputParser());
    const answer = await chain.invoke({ context, question });

    return { answer, sources: relevantDocs.map((doc) => doc.pageContent) };
  }
}
