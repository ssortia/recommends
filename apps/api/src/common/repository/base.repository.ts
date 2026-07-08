import { Injectable } from '@nestjs/common';

/**
 * Минимальный структурный тип для CRUD-операций базового репозитория.
 * Prisma-делегаты (например, PrismaClient['user']) удовлетворяют этому
 * интерфейсу структурно; конкретные репозитории обращаются к типизированному
 * делегату напрямую для доменных запросов (findUnique по не-id полю,
 * findMany с select/orderBy и т.д.).
 */
export type BaseModelDelegate<TModel, TCreateInput, TUpdateInput> = {
  findUnique(args: { where: { id: string } }): Promise<TModel | null>;
  findMany(args?: object): Promise<TModel[]>;
  create(args: { data: TCreateInput }): Promise<TModel>;
  update(args: { where: { id: string }; data: TUpdateInput }): Promise<TModel>;
  delete(args: { where: { id: string } }): Promise<TModel>;
};

/**
 * Абстрактный базовый репозиторий: общие CRUD-операции по идентификатору
 * поверх Prisma-делегата.
 *
 * Использование:
 *   class FooRepository extends BaseRepository<Foo, Prisma.FooCreateInput, Prisma.FooUpdateInput> {
 *     constructor(prisma: PrismaService) {
 *       super(prisma.foo as unknown as BaseModelDelegate<...>);
 *     }
 *   }
 *
 * Каст `as unknown as BaseModelDelegate` необходим: Prisma-делегаты используют
 * сложные условные дженерики (SelectSubset, GetFindResult, Prisma__ModelClient),
 * которые TypeScript не может унифицировать с простым структурным интерфейсом
 * в точке присваивания, хотя все вызовы методов полностью типобезопасны.
 */
@Injectable()
export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  constructor(protected readonly delegate: BaseModelDelegate<TModel, TCreateInput, TUpdateInput>) {}

  findById(id: string): Promise<TModel | null> {
    return this.delegate.findUnique({ where: { id } });
  }

  protected findAll(): Promise<TModel[]> {
    return this.delegate.findMany();
  }

  protected create(data: TCreateInput): Promise<TModel> {
    return this.delegate.create({ data });
  }

  protected update(id: string, data: TUpdateInput): Promise<TModel> {
    return this.delegate.update({ where: { id }, data });
  }

  protected delete(id: string): Promise<TModel> {
    return this.delegate.delete({ where: { id } });
  }
}
